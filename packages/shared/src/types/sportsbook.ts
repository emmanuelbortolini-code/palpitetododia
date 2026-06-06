export type CommissionType = 'cpa' | 'revshare' | 'hybrid';

export interface Sportsbook {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  affiliate_url: string;
  commission_type: CommissionType;
  commission_rate: number;
  is_active: boolean;
  description: string | null;
  website_url: string | null;
  total_clicks: number;
  total_signups: number;
  total_revenue: number;
  created_at: string;
  updated_at: string;
}
