import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, 
  Coffee, 
  Hammer, 
  MessageSquareText, 
  FileText, 
  Download, 
  Search, 
  ChevronDown, 
  Sparkles,
  ArrowUpDown,
  RefreshCcw,
  X
} from 'lucide-react';
import { parseCSV, formatCurrency, identifyColumns, downloadPDF, parseDate } from './utils';
import { LogEntry, ReportConfig, ColumnDefinition, FilterState } from './types';

// --- Constants & Config ---
const REPORTS: ReportConfig[] = [
  {
    id: 'worklog',
    title: 'Worklog Report',
    type: 'work',
    primaryColor: 'text-blue-600',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRppVpVKZyqlGUMyj5ittwOEzKkG5aarI5T1ZL__ahFnkE_IPAMPRlyKxD3UHP1QZQmvDGSQqp2nXya/pub?gid=963052324&single=true&output=csv'
  },
  {
    id: 'material',
    title: 'Material Log Report',
    type: 'material',
    primaryColor: 'text-amber-600',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRojP6VfHlmeCYOYSW5NGTlXvHFK_M4MGgiziRwc443SCJGOD2K13qS9aF4_lLJeAEXa3VDh_lhIQWS/pub?gid=1476787141&single=true&output=csv'
  },
  {
    id: 'enquiry',
    title: 'Site Enquiry Log',
    type: 'enquiry',
    primaryColor: 'text-purple-600',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTzOSn7-7AhZkO5znAq056hNmZlToLGWEVeWxDHgmG7K3ycuBpIJLRRXLzSx7aCAdPbhZU8jkzm_dSP/pub?gid=0&single=true&output=csv'
  },
  {
    id: 'tealog',
    title: 'Tea Log Report',
    type: 'tea',
    primaryColor: 'text-emerald-600',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSfFMFhgoEGZjCoX9WMlb5cH8nAaL3D7yE2w4De1Ba5bgThAD5C4yAk6pkW9Y0NDVTMr7dZ3fiemR6J/pub?gid=1343982457&single=true&output=csv'
  }
];

// --- Components ---

const Header = ({ activeTab, onTabChange }: { activeTab: string, onTabChange: (id: string) => void }) => {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Always show if near top to avoid getting stuck
      if (currentScrollY < 10) {
        setIsVisible(true);
        lastScrollY.current = currentScrollY;
        return;
      }

      // Hysteresis threshold to prevent flickering on small movements
      if (Math.abs(currentScrollY - lastScrollY.current) < 10) return;

      if (currentScrollY > lastScrollY.current) {
        // Scrolling down
        setIsVisible(false);
      } else {
        // Scrolling up
        setIsVisible(true);
      }
      
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header 
      className={`
        bg-white/90 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-30 transition-transform duration-300 
        ${isVisible ? 'translate-y-0' : '-translate-y-full'} md:translate-y-0
      `}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between h-auto md:h-20 py-3 md:py-0 gap-4">
          
          {/* Logo Area */}
          <div className="flex items-center gap-3 self-start md:self-auto w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-2.5 rounded-xl shadow-lg shadow-indigo-200/50">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">Firm Reports</h1>
            </div>
          </div>

          {/* Navigation Bar */}
          <nav className="w-full md:w-auto">
            <div className="grid grid-cols-2 sm:flex p-1.5 bg-slate-100 rounded-xl border border-slate-200 gap-1 sm:gap-0">
              {REPORTS.map((report) => {
                const Icon = report.type === 'work' ? LayoutDashboard 
                  : report.type === 'tea' ? Coffee 
                  : report.type === 'material' ? Hammer 
                  : MessageSquareText;
                
                const isActive = activeTab === report.id;
                
                return (
                  <button
                    key={report.id}
                    onClick={() => onTabChange(report.id)}
                    className={`
                      relative flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ease-out
                      ${isActive 
                        ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-900/5' 
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'}
                    `}
                  >
                    <Icon className={`h-4 w-4 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span className="truncate sm:overflow-visible">{report.title.replace(' Log', '').replace(' Report', '')}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
};

const FilterBar = ({ 
  columns, 
  data, 
  filters, 
  setFilters,
  reportId
}: { 
  columns: ColumnDefinition[], 
  data: LogEntry[], 
  filters: FilterState, 
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>,
  reportId: string
}) => {
  const filterableColumns = useMemo(() => {
    // 1. Define Priorities
    // Columns that must appear at the START
    const startPriorities: Record<string, string[]> = {
      'material': ['Material', 'Materials'] 
    };

    // Columns that must appear at the END
    const endPriorities: Record<string, string[]> = {
      'worklog': ['Work Description']
    };

    // Columns to explicitly exclude
    const blacklist: Record<string, string[]> = {
      'worklog': ['MA'],
      'tealog': ['Biscuit', 'Biscuits']
    };

    const startKeys = startPriorities[reportId] || [];
    const endKeys = endPriorities[reportId] || [];
    const blockedKeys = blacklist[reportId] || [];

    const matchKey = (col: ColumnDefinition, keys: string[]) => 
      keys.some(k => col.key.toLowerCase().trim() === k.toLowerCase() || col.label.toLowerCase().trim() === k.toLowerCase());

    // 2. Identify Forced Columns
    const startCols = columns.filter(col => matchKey(col, startKeys));
    const endCols = columns.filter(col => matchKey(col, endKeys));

    // 3. Identify Auto Suggested Columns
    const autoCols = columns.filter(col => {
      // Skip if already selected as forced
      if (startCols.some(p => p.key === col.key)) return false;
      if (endCols.some(p => p.key === col.key)) return false;
      
      // Skip if blacklisted
      if (matchKey(col, blockedKeys)) return false;

      // Skip numeric amounts
      if (col.isNumeric && col.label.toLowerCase().includes('amount')) return false;

      const uniqueValues = new Set(data.map(row => String(row[col.key])));
      // Limit auto-columns to small sets
      return uniqueValues.size > 0 && uniqueValues.size < 20;
    });

    // 4. Construct Final List (Max 4 slots)
    // Reserve space for Start and End columns first
    const availableSlots = Math.max(0, 4 - startCols.length - endCols.length);
    const selectedAutoCols = autoCols.slice(0, availableSlots);

    return [...startCols, ...selectedAutoCols, ...endCols];
  }, [columns, data, reportId]);

  const getUniqueValues = (key: string) => {
    return Array.from(new Set(data.map(item => String(item[key])))).sort();
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Filters</h2>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
          <Sparkles className="h-4 w-4" />
          Analyze
        </button>
      </div>
      
      {filterableColumns.length === 0 ? (
        <p className="text-sm text-slate-400 italic">No categorical data available for filtering.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filterableColumns.map((col) => (
            <div key={col.key}>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 ml-1">
                {col.label}
              </label>
              <div className="relative">
                <select
                  value={filters[col.key] || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
                  className="w-full appearance-none bg-white border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 pr-8"
                >
                  <option value="">All</option>
                  {getUniqueValues(col.key).map((val) => (
                    <option key={val} value={val}>{val}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const DataTable = ({ 
  data, 
  columns, 
  loading,
  title,
  onRowClick
}: { 
  data: LogEntry[], 
  columns: ColumnDefinition[], 
  loading: boolean,
  title: string,
  onRowClick: (entry: LogEntry) => void
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [data.length, entriesPerPage, searchTerm]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const processedData = useMemo(() => {
    let filtered = data.filter(item => 
      Object.values(item).some(val => 
        String(val).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );

    if (sortConfig) {
      filtered.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        
        const colDef = columns.find(c => c.key === sortConfig.key);

        if (colDef?.isDate) {
            const dateA = parseDate(String(valA));
            const dateB = parseDate(String(valB));
            const validA = !isNaN(dateA);
            const validB = !isNaN(dateB);

            if (validA && validB) {
                return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
            }
            if (validA && !validB) return -1;
            if (!validA && validB) return 1;
        }
        
        const numA = parseFloat(String(valA).replace(/[^0-9.-]+/g, ""));
        const numB = parseFloat(String(valB).replace(/[^0-9.-]+/g, ""));

        if (colDef?.isNumeric && !isNaN(numA) && !isNaN(numB)) {
          return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [data, searchTerm, sortConfig, columns]);

  const totalPages = Math.ceil(processedData.length / entriesPerPage);
  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = processedData.slice(indexOfFirstEntry, indexOfLastEntry);

  const handleDownload = () => {
    downloadPDF(title, columns, processedData);
  };

  if (loading) {
    return <div className="bg-white p-12 text-center rounded-xl shadow-sm border border-slate-100">
      <RefreshCcw className="h-8 w-8 text-indigo-500 animate-spin mx-auto mb-4" />
      <p className="text-slate-500">Loading data...</p>
    </div>;
  }

  if (data.length === 0) {
    return <div className="bg-white p-12 text-center rounded-xl shadow-sm border border-slate-100">
      <p className="text-slate-500">No data found. Please check the source spreadsheet.</p>
    </div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Full Data Set</h2>
        </div>
        <button 
          onClick={handleDownload}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors w-full md:w-auto justify-center"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </button>
      </div>

      <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span>Show</span>
          <select 
            value={entriesPerPage}
            onChange={(e) => setEntriesPerPage(Number(e.target.value))}
            className="bg-white border border-slate-300 text-slate-900 text-sm rounded-md focus:ring-indigo-500 focus:border-indigo-500 block p-1.5"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>entries</span>
        </div>

        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="w-4 h-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full p-2 pl-10 text-sm text-slate-900 border border-slate-300 rounded-lg bg-white focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400"
            placeholder="Search records..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm text-left text-slate-500 min-w-full">
          <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
            <tr>
              {columns.map((col) => (
                <th 
                  key={col.key} 
                  scope="col" 
                  className="px-4 py-3 sm:px-6 sm:py-4 font-semibold whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors group"
                  onClick={() => handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    <ArrowUpDown className={`h-3 w-3 ${sortConfig?.key === col.key ? 'text-indigo-600' : 'text-slate-300 group-hover:text-slate-500'}`} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentEntries.map((row, index) => (
              <tr 
                key={index} 
                onClick={() => onRowClick(row)}
                className="bg-white border-b border-slate-100 hover:bg-indigo-50/50 cursor-pointer transition-colors active:bg-indigo-100"
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 sm:px-6 sm:py-4 font-medium text-slate-900 whitespace-nowrap max-w-xs overflow-hidden text-ellipsis">
                    {col.isNumeric && /amount|price|cost|total/i.test(col.key) 
                      ? formatCurrency(parseFloat(String(row[col.key]).replace(/[^0-9.-]+/g, "")) || 0)
                      : row[col.key]
                    }
                  </td>
                ))}
              </tr>
            ))}
            {currentEntries.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-6 py-8 text-center text-slate-400">
                  No records match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center p-4 gap-4 bg-white">
        <span className="text-sm text-slate-700">
          Showing <span className="font-semibold text-slate-900">{indexOfFirstEntry + 1}</span> to <span className="font-semibold text-slate-900">{Math.min(indexOfLastEntry, processedData.length)}</span> of <span className="font-semibold text-slate-900">{processedData.length}</span> entries
        </span>
        
        <div className="inline-flex -space-x-px text-sm">
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex items-center justify-center px-3 h-8 ml-0 leading-tight text-slate-500 bg-white border border-slate-300 rounded-l-lg hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          {[...Array(Math.min(5, totalPages))].map((_, i) => {
            let pageNum = i + 1;
            if (totalPages > 5 && currentPage > 3) {
              pageNum = currentPage - 2 + i;
            }
            if (pageNum > totalPages) return null;

            return (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`flex items-center justify-center px-3 h-8 leading-tight border border-slate-300 ${currentPage === pageNum ? 'bg-indigo-50 text-indigo-600 font-bold border-indigo-300' : 'bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
              >
                {pageNum}
              </button>
            );
          })}
          
          <button 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="flex items-center justify-center px-3 h-8 leading-tight text-slate-500 bg-white border border-slate-300 rounded-r-lg hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

const EntryDetailsModal = ({ entry, onClose }: { entry: LogEntry | null, onClose: () => void }) => {
  if (!entry) return null;

  const details = Object.entries(entry).filter(([_, value]) => {
     if (value === null || value === undefined) return false;
     const strVal = String(value).trim();
     return strVal !== '' && strVal !== '-';
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col animate-in zoom-in-95 duration-200" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
            <h3 className="text-xl font-bold text-slate-800">Entry Details</h3>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="h-5 w-5 text-slate-500" />
            </button>
        </div>
        <div className="p-6 space-y-4">
            {details.map(([key, value]) => (
                <div key={key} className="flex flex-col border-b border-slate-50 last:border-0 pb-3 last:pb-0">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        {key.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm sm:text-base text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">
                        {value}
                    </span>
                </div>
            ))}
            {details.length === 0 && <p className="text-slate-400 italic">No details available.</p>}
        </div>
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
            <button onClick={onClose} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-colors shadow-md shadow-indigo-200">
                Close
            </button>
        </div>
      </div>
    </div>
  )
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState(REPORTS[0].id);
  const [data, setData] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState<ColumnDefinition[]>([]);
  const [filters, setFilters] = useState<FilterState>({});
  const [selectedEntry, setSelectedEntry] = useState<LogEntry | null>(null);

  const activeReport = REPORTS.find(r => r.id === activeTab) || REPORTS[0];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setData([]);
      setFilters({});
      
      try {
        const fetchedData = await parseCSV(activeReport.url);
        setData(fetchedData);
        
        let cols = identifyColumns(fetchedData);
        
        // --- Custom Logic for specific Reports ---
        
        if (activeReport.id === 'worklog') {
            // Remove 3rd (index 2) and 4th (index 3) columns if enough columns exist
            // Important: We filter by index from the detected columns
            if (cols.length > 3) {
                // Filter out indices 2 and 3
                cols = cols.filter((_, index) => index !== 2 && index !== 3);
            } else if (cols.length > 2) {
                cols = cols.filter((_, index) => index !== 2);
            }
        }
        else if (activeReport.id === 'material') {
            // Remove third column (index 2)
            if (cols.length > 2) {
                cols.splice(2, 1);
            }
        }

        setColumns(cols);
      } catch (error) {
        console.error("Failed to fetch data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeReport]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      return Object.keys(filters).every(key => {
        if (!filters[key]) return true;
        return String(item[key]) === filters[key];
      });
    });
  }, [data, filters]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-12">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-10">
          <h1 className={`text-4xl font-extrabold ${activeReport.primaryColor} mb-2 tracking-tight`}>
            {activeReport.title}
          </h1>
          <p className="text-slate-500">
            Real-time tracking and analysis of site operations
          </p>
        </div>

        {!loading && (
          <FilterBar 
            columns={columns} 
            data={data} 
            filters={filters}
            setFilters={setFilters}
            reportId={activeReport.id}
          />
        )}

        <DataTable 
          data={filteredData} 
          columns={columns} 
          loading={loading} 
          title={activeReport.title} 
          onRowClick={setSelectedEntry}
        />
      </main>

      <EntryDetailsModal 
        entry={selectedEntry} 
        onClose={() => setSelectedEntry(null)} 
      />
    </div>
  );
};

export default App;