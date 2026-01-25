export interface LogEntry {
  [key: string]: string | number;
}

export interface ReportConfig {
  id: string;
  title: string;
  url: string;
  type: 'work' | 'tea' | 'material' | 'enquiry';
  primaryColor: string;
}

export interface FilterState {
  [key: string]: string;
}

export interface ColumnDefinition {
  key: string;
  label: string;
  isNumeric?: boolean;
  isDate?: boolean;
}