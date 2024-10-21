import React from 'react';

interface Warehouse {
  warehouseType: string;
  status: string;
  // Add more properties as needed
}

interface WarehousesTableProps {
  warehouses: Warehouse[];
}

export function WarehousesTable({ warehouses }: WarehousesTableProps) {
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
        {warehouses.map((warehouse: { warehouseType: string; status: string }, index: number) => (
          <tr key={index}>
            <td>{warehouse.warehouseType}</td>
            <td>{warehouse.status}</td>
            {/* Add more table cells as needed */}
          </tr>
        ))}
      </tbody>
    </table>
  );
}