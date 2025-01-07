import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Clock, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { createClient } from '@supabase/supabase-js';
import Terminal, { ColorMode, TerminalOutput } from 'react-terminal-ui';

interface ProgressBarProps {
  progress: number;
}

interface StatusBadgeProps {
  status: string;
}

interface SourceIconProps {
  source: string;
}

interface Dispatch {
  id: string;
  status: string;
  progress: number;
  source: string;
  created_at: string;
  portalId: string;
  lambda_url: string | null;
  logs?: string[];
}

interface DispatchTableProps {
  dispatches: Dispatch[];
}

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

// Initialize Lambda client
const lambdaClient = new LambdaClient({ region: process.env.NEXT_PUBLIC_AWS_REGION! });

// Status badge component
const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStatusStyles = () => {
    switch (status) {
      case 'complete':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="w-4 h-4" />;
      case 'error':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${getStatusStyles()}`}>
      {getStatusIcon()}
      <span className="text-sm font-medium capitalize">{status}</span>
    </div>
  );
};

// Progress bar component
const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => (
  <div className="w-full bg-gray-200 rounded-full h-2.5">
    <div
      className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
      style={{ width: `${progress}%` }}
    />
  </div>
);

// Source icon component
const SourceIcon: React.FC<SourceIconProps> = ({ source }) => {
  const getSourceSvg = () => {
    switch (source.toLowerCase()) {
      case 'clickhouse':
        return (
          <svg viewBox="0 0 24 24" className="w-6 h-6">
            <path fill="#FFCC01" d="M3,3 L21,3 L21,21 L3,21 L3,3 Z M6,6 L6,18 L18,18 L18,6 L6,6 Z" />
            <rect fill="#FFCC01" x="9" y="9" width="6" height="6" />
          </svg>
        );
      case 'redshift':
        return (
          <svg viewBox="0 0 24 24" className="w-6 h-6">
            <path fill="#205B97" d="M12,2 L22,7 L22,17 L12,22 L2,17 L2,7 L12,2 Z" />
          </svg>
        );
      default:
        return <div className="w-6 h-6 bg-gray-200 rounded" />;
    }
  };

  return (
    <div className="flex items-center gap-2">
      {getSourceSvg()}
      <span className="text-sm font-medium">{source}</span>
    </div>
  );
};

// Fetch the lambda_url from the portals table
const getLambdaUrl = async (portalId: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('portals')
    .select('lambda_url')
    .eq('id', portalId)
    .single(); // Assuming portalId is unique

  if (error) {
    console.error('Error fetching lambda_url:', error);
    return null;
  }

  return data?.lambda_url ?? null;
};

const DispatchTable: React.FC<DispatchTableProps> = ({ dispatches }) => {
  const router = useRouter();
  const [expandedDispatchId, setExpandedDispatchId] = useState<string | null>(null);
  const [logs, setLogs] = useState<{ [key: string]: string[] }>({});

  // Add a useEffect to load the lambda_url for each dispatch
  useEffect(() => {
    const loadLambdaUrls = async () => {
      for (const dispatch of dispatches) {
        if (dispatch.portalId && !dispatch.lambda_url) {
          const lambdaUrl = await getLambdaUrl(dispatch.portalId);
          dispatch.lambda_url = lambdaUrl;
        }
      }
    };

    loadLambdaUrls();
  }, [dispatches]);

  const streamLogs = (lambdaUrl: string, dispatchId: string) => {
    const eventSource = new EventSource(lambdaUrl);

    eventSource.onmessage = (event) => {
      const newLog = event.data;
      setLogs((prevLogs) => ({
        ...prevLogs,
        [dispatchId]: [...(prevLogs[dispatchId] || []), newLog],
      }));
    };

    eventSource.onerror = () => {
      console.error('Error streaming logs');
      eventSource.close();
    };

    return eventSource;
  };

  const toggleLogs = (dispatchId: string, lambdaUrl?: string | null) => {
    setExpandedDispatchId(expandedDispatchId === dispatchId ? null : dispatchId);

    if (lambdaUrl) {
      streamLogs(lambdaUrl, dispatchId);
    }
  };

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-6 py-3 font-semibold">Status</th>
              <th className="px-6 py-3 font-semibold">Progress</th>
              <th className="px-6 py-3 font-semibold">Source</th>
              <th className="px-6 py-3 font-semibold">Created</th>
              <th className="px-6 py-3 font-semibold sr-only">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {dispatches.map((dispatch) => (
              <React.Fragment key={dispatch.id}>
                <tr
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => toggleLogs(dispatch.id, dispatch.lambda_url)}
                >
                  <td className="px-6 py-4">
                    <StatusBadge status={dispatch.status} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <ProgressBar progress={dispatch.progress} />
                      <span className="text-sm text-gray-600">{dispatch.progress}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <SourceIcon source={dispatch.source} />
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {new Date(dispatch.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </td>
                </tr>

                {/* Collapsible Log Section with Terminal UI */}
                {expandedDispatchId === dispatch.id && (
                  <tr className="bg-black">
                    <td colSpan={5} className="px-6 py-4">
                      <div className="space-y-2">
                        <Terminal
                          name="Dispatch Logs"
                          colorMode={ColorMode.Dark}
                          height="500"
                        >
                          {(logs[dispatch.id] || []).map((log, index) => (
                            <TerminalOutput key={index}>{log}</TerminalOutput>
                          ))}
                        </Terminal>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DispatchTable;
