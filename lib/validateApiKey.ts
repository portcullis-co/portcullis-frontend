import { createClient } from '@/lib/supabase/server';

export async function validateApiKey(apiKey: string | null): Promise<{
  isValid: boolean;
  organizationId?: string;
}> {
  if (!apiKey) {
    return { isValid: false };
  }

  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('api_key', apiKey)
    .single();

  if (error || !data) {
    return { isValid: false };
  }

  return {
    isValid: true,
    organizationId: data.id
  };
}