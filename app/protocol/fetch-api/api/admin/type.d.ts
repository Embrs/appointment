// 平台管理員：AdminUser CRUD type 定義

interface AdminItem {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// GetAdminList -----------------------------------------------------------------------------------

interface GetAdminListRes {
  items: AdminItem[];
}

// CreateAdmin ------------------------------------------------------------------------------------

interface CreateAdminParams {
  email: string;
  password: string;
  name: string;
}

interface CreateAdminRes {
  admin: AdminItem;
}

// UpdateAdmin ------------------------------------------------------------------------------------

interface UpdateAdminParams {
  id: string;
  name?: string;
  password?: string;
}

interface UpdateAdminRes {
  admin: AdminItem;
}

// ToggleAdminActive ------------------------------------------------------------------------------

interface ToggleAdminActiveParams {
  id: string;
}

interface ToggleAdminActiveRes {
  admin: AdminItem;
}
