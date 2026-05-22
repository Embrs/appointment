// 商家服務人員（Provider）type 定義

interface ProviderItem {
  id: string;
  name: string;
  title?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
  displayOrder: number;
  serviceIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface GetProviderListRes {
  items: ProviderItem[];
}

interface CreateProviderParams {
  name: string;
  title?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  isActive?: boolean;
  displayOrder?: number;
}

interface CreateProviderRes {
  provider: ProviderItem;
}

interface GetProviderParams {
  id: string;
}

interface GetProviderRes {
  provider: ProviderItem;
}

interface UpdateProviderParams {
  id: string;
  name?: string;
  title?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  isActive?: boolean;
  displayOrder?: number;
}

interface UpdateProviderRes {
  provider: ProviderItem;
}

interface DeleteProviderParams {
  id: string;
}

interface DeleteProviderRes {
  id: string;
}

// 公開端
interface PublicProviderItem {
  id: string;
  name: string;
  title?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  displayOrder: number;
  serviceIds: string[];
}

interface GetPublicProviderListParams {
  slug: string;
}

interface GetPublicProviderListRes {
  items: PublicProviderItem[];
}
