import * as file from './api/file';
import * as auth from './api/auth';
import * as tinymce from './api/tinymce';
import * as admin from './api/admin';
import * as merchant from './api/merchant';
import * as service from './api/service';
import * as resource from './api/resource';
import * as provider from './api/provider';
import * as schedule from './api/schedule';
import * as holiday from './api/holiday';
import * as upload from './api/upload';
import * as availability from './api/availability';
import * as appointment from './api/appointment';
import * as customer from './api/customer';
import * as queue from './api/queue';

export default {
  ...file,
  ...auth,
  ...tinymce,
  ...admin,
  ...merchant,
  ...service,
  ...resource,
  ...provider,
  ...schedule,
  ...holiday,
  ...upload,
  ...availability,
  ...appointment,
  ...customer,
  ...queue
};


// // 使用 Vite 的 import.meta.glob 自動聚合 api 模組
// // 會自動載入 ./api/**/index.ts 中的所有 named export，並合併成單一物件輸出
// const modules = import.meta.glob('./api/**/index.ts', { eager: true }) as Record<string, any>;
// const apiExports: Record<string, any> = {};

// for (const key in modules) {
//   const mod = modules[key] as Record<string, any>;
//   Object.assign(apiExports, mod);
// }

// export default apiExports;
