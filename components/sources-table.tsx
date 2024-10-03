import React from 'react';

export function SourcesTable({ sources }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Warehouse Type</th>
          <th>Connection Status</th>
          {/* Add more table headers as needed */}
        </tr>
      </thead>
      <tbody>
        {sources.map((source, index) => (
          <tr key={index}>
            <td>{source.warehouseType}</td>
            <td>{source.status}</td>
            {/* Add more table cells as needed */}
          </tr>
        ))}
      </tbody>
    </table>
  );
}