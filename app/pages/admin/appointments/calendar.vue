<script setup lang="ts">
// PageAdminAppointmentsCalendar — 舊路由保留，自動重導向 /admin/appointments?view=calendar
definePageMeta({
  layout: 'back-desk',
  middleware: ['merchant']
});

const router = useRouter();
const localePath = useLocalePath();
await router.replace(localePath('/admin/appointments?view=calendar'));
</script>

<template lang="pug">
.PageAdminAppointmentsCalendarRedirect
</template>
