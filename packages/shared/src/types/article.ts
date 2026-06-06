export type ArticleStatus =
  | 'draft'
  | 'pending_review'
  | 'published'
  | 'rejected'
  | 'archived';

export interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image_url: string | null;
  author_id: string;
  published_by_admin_id: string | null;
  status: ArticleStatus;
  rejection_reason: string | null;
  meta_description: string | null;
  keywords: string | null;
  views_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
