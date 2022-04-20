import React, { useRef, useEffect } from 'react';
import { DataFrame, ArrayVector, Field, TimeZone } from '@grafana/data';
import { BucketLayout } from '../fields';
import { HeatmapHoverProps, HeatmapLayerHover } from '../types';
import { timeFormatter } from '../utils';
import { DataHoverView } from '../components/DataHoverView';

interface HistogramFooterProps {
  xField: Field;
  yField: Field;
  countField: Field;
  index: number;
  yBucketCount?: number;
}

const HistogramFooter = ({ xField, yField, countField, index, yBucketCount }: HistogramFooterProps) => {
  let can = useRef<HTMLCanvasElement>(null);

  let histCssWidth = 150;
  let histCssHeight = 50;
  let histCanWidth = Math.round(histCssWidth * devicePixelRatio);
  let histCanHeight = Math.round(histCssHeight * devicePixelRatio);

  const xVals = xField.values.toArray();
  const yVals = yField.values.toArray();
  const countVals = countField?.values.toArray();

  useEffect(
    () => {
      let histCtx = can.current?.getContext('2d');

      if (histCtx && xVals && yVals && countVals) {
        let fromIdx = index;

        while (xVals[fromIdx--] === xVals[index]) {}

        fromIdx++;

        let toIdx = fromIdx + yBucketCount!;

        let maxCount = 0;

        let i = fromIdx;
        while (i < toIdx) {
          let c = countVals[i];
          maxCount = Math.max(maxCount, c);
          i++;
        }

        let pHov = new Path2D();
        let pRest = new Path2D();

        i = fromIdx;
        let j = 0;
        while (i < toIdx) {
          let c = countVals[i];

          if (c > 0) {
            let pctY = c / maxCount;
            let pctX = j / (yBucketCount! + 1);

            let p = i === index ? pHov : pRest;

            p.rect(
              Math.round(histCanWidth * pctX),
              Math.round(histCanHeight * (1 - pctY)),
              Math.round(histCanWidth / yBucketCount!),
              Math.round(histCanHeight * pctY)
            );
          }

          i++;
          j++;
        }

        histCtx.clearRect(0, 0, histCanWidth, histCanHeight);

        histCtx.fillStyle = '#ffffff80';
        histCtx.fill(pRest);

        histCtx.fillStyle = '#ff000080';
        histCtx.fill(pHov);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [index]
  );

  return (
    <>
      <canvas
        width={histCanWidth}
        height={histCanHeight}
        ref={can}
        style={{ width: histCanWidth + 'px', height: histCanHeight + 'px' }}
      />
    </>
  );
};

interface HeatmapLayerOptions {
  timeZone: TimeZone;
  showHistogram?: boolean;
}

export const HeatmapTab = ({
  heatmapData,
  index,
  getValuesInCell,
  options,
}: HeatmapHoverProps<HeatmapLayerOptions>): HeatmapLayerHover[] => {
  const xFields: Field[] | undefined = heatmapData.heatmap?.fields.filter((f) => f.name === 'xMin');
  const yFields: Field[] | undefined = heatmapData.heatmap?.fields.filter((f) => f.name === 'yMin');
  const countFields: Field[] | undefined = heatmapData.heatmap?.fields.filter((f) => f.name === 'count');

  if (xFields && yFields && countFields) {
    return xFields.map((xField, i) => {
      const yField = yFields[i];
      const countField = countFields[i];

      console.log('i', i, 'xField', xField, 'yField', yField, 'countField', countField);
      const yValueIdx = index % heatmapData.yBucketCount! ?? 0;

      const yMinIdx = heatmapData.yLayout === BucketLayout.le ? yValueIdx - 1 : yValueIdx;
      const yMaxIdx = heatmapData.yLayout === BucketLayout.le ? yValueIdx : yValueIdx + 1;

      const xMin: number = xField.values.get(index);
      const xMax: number = xMin + heatmapData.xBucketSize!;
      const yMin: number = yField.values.get(yMinIdx);
      const yMax: number = yField.values.get(yMaxIdx);
      const count: number = countField.values.get(index);

      const data: DataFrame[] | undefined = getValuesInCell!({
        xRange: {
          min: xMin,
          max: xMax,
          delta: heatmapData.xBucketSize || 0,
        },
        yRange: {
          min: yMin,
          max: yMax,
          delta: heatmapData.yBucketSize || 0,
        },
        count,
      });

      const summaryData: DataFrame = {
        fields: [
          {
            ...xField,
            config: {
              ...xField.config,
              displayNameFromDS: 'xMin',
            },
            display: (value: number) => {
              return {
                numeric: value,
                text: timeFormatter(value, options?.timeZone!),
              };
            },
            state: {
              ...xField.state,
              displayName: 'xMin',
            },
            values: new ArrayVector([xMin]),
          },
          {
            ...xField,
            config: {
              ...xField.config,
              displayNameFromDS: 'xMax',
            },
            display: (value: number) => {
              return {
                numeric: value,
                text: timeFormatter(value, options?.timeZone!),
              };
            },
            state: {
              ...xField.state,
              displayName: 'xMax',
            },
            values: new ArrayVector([xMax]),
          },
          {
            ...yField,
            config: {
              ...yField.config,
              displayNameFromDS: 'yMin',
            },
            state: {
              ...yField.state,
              displayName: 'yMin',
            },
            values: new ArrayVector([yMin]),
          },
          {
            ...yField,
            config: {
              ...yField.config,
              displayNameFromDS: 'yMax',
            },
            state: {
              ...yField.state,
              displayName: 'yMax',
            },
            values: new ArrayVector([yMax]),
          },
          {
            ...countField,
            values: new ArrayVector([count]),
          },
        ],
        length: 5,
      };

      const footer = () => {
        if (options?.showHistogram!) {
          return (
            <HistogramFooter
              xField={xField}
              yField={yField}
              countField={countField}
              index={index}
              yBucketCount={heatmapData.yBucketCount}
            />
          );
        }
        return <></>;
      };

      const header = () => {
        return <DataHoverView data={summaryData} rowIndex={0} />;
      };

      if (data) {
        return {
          name: yField.config.displayNameFromDS ?? yField.config.displayName ?? 'Heatmap',
          header,
          data,
          footer,
        };
      }

      return {
        name: yField.config.displayNameFromDS ?? yField.config.displayName ?? 'Heatmap',
        data: [summaryData],
      };
    });
  }

  return [
    {
      name: 'Heatmap',
      data: [],
    },
  ];
};