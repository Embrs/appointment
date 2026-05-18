<script setup lang="ts">
// PageSignIn — 商家 / 平台管理員登入
// 用 ?type=merchant|admin 切換身份（預設 merchant）
import type { FormInstance, FormRules } from 'element-plus';

definePageMeta({ layout: 'default' });

const route = useRoute();
const router = useRouter();
const storeSelf = StoreSelf();
const verify = UseVerify();

const signInType = computed<'merchant' | 'admin'>(() =>
  route.query.type === 'admin' ? 'admin' : 'merchant'
);

const formRef = ref<FormInstance | null>(null);
const submitting = ref(false);
const form = reactive({
  email: '',
  password: ''
});

const rules: FormRules = {
  email: [verify.mail.value],
  password: [verify.enter.value]
};

const title = computed(() =>
  signInType.value === 'admin' ? '平台管理員登入' : '商家登入'
);

const PickLocaleMessage = (msg: { zh_tw?: string; en?: string; ja?: string } | undefined): string =>
  msg?.zh_tw || msg?.en || msg?.ja || '操作失敗';

const ApiSignIn = async () => {
  const params = { email: form.email.trim(), password: form.password };
  return signInType.value === 'admin'
    ? await $api.SignInAdmin(params)
    : await $api.SignInMerchant(params);
};

const SignInFlow = async () => {
  submitting.value = true;
  try {
    const res = await ApiSignIn();
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(PickLocaleMessage(res.status.message));
      return;
    }
    const data = res.data as any;
    storeSelf.SetIdentity({
      token: data.token,
      type: data.type,
      role: data.role ?? '',
      merchantId: data.merchantId ?? '',
      userName: data.userName ?? '',
      userEmail: data.userEmail ?? ''
    });
    // 清除可能殘留的代理備份（避免登出後仍能還原舊 admin 身分）
    UseImpersonation().ClearBackup();
    ElMessage.success('登入成功');
    if (data.type === 'admin') {
      router.push('/sys');
    } else {
      router.push('/admin');
    }
  } finally {
    submitting.value = false;
  }
};

const ClickSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  await SignInFlow();
};
</script>

<template lang="pug">
.PageSignIn
  .PageSignIn__card
    h1.PageSignIn__title {{ title }}
    ElForm(
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      @submit.prevent="ClickSubmit"
    )
      ElFormItem(label="Email" prop="email")
        ElInput(
          v-model="form.email"
          type="email"
          maxlength="120"
          autocomplete="email"
          placeholder="example@domain.com"
        )
      ElFormItem(label="密碼" prop="password")
        ElInput(
          v-model="form.password"
          type="password"
          maxlength="64"
          show-password
          autocomplete="current-password"
          placeholder="請輸入密碼"
        )
      ElButton.PageSignIn__submit(
        type="primary"
        native-type="submit"
        :loading="submitting"
        @click="ClickSubmit"
      ) 登入

    .PageSignIn__links(v-if="signInType === 'merchant'")
      NuxtLink.PageSignIn__link(to="/sign-up") 立即註冊
      span.PageSignIn__divider |
      NuxtLink.PageSignIn__link(to="/forgot-password") 忘記密碼
</template>

<style lang="scss" scoped>
.PageSignIn {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background-color: #f5f7fa;
}

.PageSignIn__card {
  width: 100%;
  max-width: 380px;
  background-color: #fff;
  border-radius: 8px;
  padding: 32px 28px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.PageSignIn__title {
  margin: 0 0 24px 0;
  font-size: 20px;
  font-weight: 600;
  text-align: center;
  color: #303133;
}

.PageSignIn__submit {
  width: 100%;
  margin-top: 8px;
}

.PageSignIn__links {
  margin-top: 16px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.PageSignIn__link {
  color: #409eff;
  text-decoration: none;
}

.PageSignIn__link:hover {
  text-decoration: underline;
}

.PageSignIn__divider {
  color: #c0c4cc;
}
</style>
