export type AcademyStatus = 'draft' | 'published' | 'archived';
export type AcademyDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface AcademyArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  cover_image_url: string | null;
  order_position: number;
  author_id: string;
  published_by_admin_id: string | null;
  status: AcademyStatus;
  published_at: string | null;
  difficulty: AcademyDifficulty;
  estimated_read_minutes: number;
  views_count: number;
  created_at: string;
  updated_at: string;
}
