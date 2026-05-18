<script setup lang="ts">
// PageForgotPassword — 忘記密碼
// MVP 不寄信，固定顯示通用成功訊息，避免 email 列舉
import type { FormInstance, FormRules } from 'element-plus';

definePageMeta({ layout: 'default' });

const verify = UseVerify();

const formRef = ref<FormInstance | null>(null);
const submitting = ref(false);
const submitted = ref(false);
const form = reactive({ email: '' });

const rules: FormRules = {
  email: [verify.mail.value]
};

const ForgotFlow = async () => {
  submitting.value = true;
  try {
    await $api.ForgotPassword({ email: form.email.trim() });
    // 不論結果一律顯示通用訊息，避免帳號列舉
    submitted.value = true;
  } finally {
    submitting.value = false;
  }
};

const ClickSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  await ForgotFlow();
};
</script>

<template lang="pug">
.PageForgotPassword
  .PageForgotPassword__card
    template(v-if="!submitted")
      h1.PageForgotPassword__title 忘記密碼
      p.PageForgotPassword__hint 輸入帳號 Email，若帳號存在我們會寄送重設連結

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
            placeholder="example@domain.com"
          )
        ElButton.PageForgotPassword__submit(
          type="primary"
          native-type="submit"
          :loading="submitting"
          @click="ClickSubmit"
        ) 送出

      .PageForgotPassword__links
        NuxtLink.PageForgotPassword__link(to="/sign-in") 返回登入

    template(v-else)
      .PageForgotPassword__notice
        h2.PageForgotPassword__noticeTitle 已送出
        p.PageForgotPassword__noticeBody 若帳號存在，您將很快收到密碼重設信件。請檢查收件匣或垃圾信件夾。
        NuxtLink.PageForgotPassword__noticeBtn(to="/sign-in")
          ElButton(type="primary") 返回登入
</template>

<style lang="scss" scoped>
.PageForgotPassword {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background-color: #f5f7fa;
}

.PageForgotPassword__card {
  width: 100%;
  max-width: 380px;
  background-color: #fff;
  border-radius: 8px;
  padding: 32px 28px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.PageForgotPassword__title {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
  text-align: center;
  color: #303133;
}

.PageForgotPassword__hint {
  margin: 0 0 24px 0;
  font-size: 13px;
  color: #909399;
  text-align: center;
  line-height: 1.5;
}

.PageForgotPassword__submit {
  width: 100%;
  margin-top: 8px;
}

.PageForgotPassword__links {
  margin-top: 16px;
  display: flex;
  justify-content: center;
  font-size: 13px;
}

.PageForgotPassword__link {
  color: #409eff;
  text-decoration: none;
}

.PageForgotPassword__link:hover {
  text-decoration: underline;
}

.PageForgotPassword__notice {
  text-align: center;
}

.PageForgotPassword__noticeTitle {
  margin: 0 0 12px 0;
  font-size: 20px;
  font-weight: 600;
  color: #409eff;
}

.PageForgotPassword__noticeBody {
  margin: 0 0 24px 0;
  font-size: 14px;
  line-height: 1.6;
  color: #606266;
}

.PageForgotPassword__noticeBtn {
  display: inline-block;
}
</style>
