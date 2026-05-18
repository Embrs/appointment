// 商家資源 type 定義

interface ResourceItem {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  displayOrder: number;
  serviceIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface GetResourceListRes {
  items: ResourceItem[];
}

interface CreateResourceParams {
  name: string;
  description?: string;
  isActive?: boolean;
  displayOrder?: number;
}

interface CreateResourceRes {
  resource: ResourceItem;
}

interface GetResourceParams {
  id: string;
}

interface GetResourceRes {
  resource: ResourceItem;
}

interface UpdateResourceParams {
  id: string;
  name?: string;
  description?: string;
  isActive?: boolean;
  displayOrder?: number;
}

interface UpdateResourceRes {
  resource: ResourceItem;
}

interface DeleteResourceParams {
  id: string;
}

interface DeleteResourceRes {
  id: string;
}
