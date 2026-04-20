import { Injectable } from "@nestjs/common";

@Injectable()
export class BiReportExcelService {
  renderDashboardReport(snapshot: {
    dashboardTitle: string;
    widgets: Array<{
      widgetTitle: string;
      metricKey: string;
      points: Array<{
        label: string;
        value: number;
        secondaryValue?: number | null;
      }>;
    }>;
  }) {
    const rows = [
      '<?xml version="1.0"?>',
      '<?mso-application progid="Excel.Sheet"?>',
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"',
      ' xmlns:o="urn:schemas-microsoft-com:office:office"',
      ' xmlns:x="urn:schemas-microsoft-com:office:excel"',
      ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
      '<Worksheet ss:Name="Dashboard">',
      "<Table>",
      this.row(["Dashboard", snapshot.dashboardTitle]),
    ];

    for (const widget of snapshot.widgets) {
      rows.push(this.row([]));
      rows.push(this.row(["Widget", widget.widgetTitle]));
      rows.push(this.row(["Metric", widget.metricKey]));
      rows.push(this.row(["Label", "Value", "Secondary Value"]));
      for (const point of widget.points) {
        rows.push(
          this.row([
            point.label,
            point.value.toString(),
            point.secondaryValue == null ? "" : point.secondaryValue.toString(),
          ]),
        );
      }
    }

    rows.push("</Table>");
    rows.push("</Worksheet>");
    rows.push("</Workbook>");
    return Buffer.from(rows.join(""), "utf8");
  }

  private row(cells: string[]) {
    return `<Row>${cells
      .map(
        (cell) =>
          `<Cell><Data ss:Type="String">${this.escape(cell)}</Data></Cell>`,
      )
      .join("")}</Row>`;
  }

  private escape(value: string) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }
}
