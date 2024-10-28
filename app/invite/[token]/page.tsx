import dynamic from 'next/dynamic'

const WarehouseConnection = dynamic(() => import('@/components/warehouse-connection'), { ssr: false })

export default function MultiStepWarehouseSharingPage({ params }: { params: { token: string } }) {
  return (
    <div className="container mx-auto py-10">
      <WarehouseConnection token={params.token} />
    </div>
  )
}
