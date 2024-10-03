import dynamic from 'next/dynamic'

const WarehouseConnection = dynamic(() => import('@/components/warehouse-connection'), { ssr: false })

export default function MultiStepWarehouseSharingPage() {
  return (
    <div className="container mx-auto py-10">
      <WarehouseConnection onClose={() => {}} />
    </div>
  )
}