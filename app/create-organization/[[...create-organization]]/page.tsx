import { CreateOrganization } from '@clerk/nextjs'

export default function CreateOrganizationPage() {
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <CreateOrganization afterCreateOrganizationUrl="/choose-plan" path="/create-organization" />
    </div>
  )
}