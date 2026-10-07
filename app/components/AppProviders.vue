<template>
	<!-- No content -->
	<!-- Slot is only used to resolve hydration mismatch issues -->
	<slot></slot>
</template>

<script lang="ts" setup>
	provide('app-name', 'AWBW Turn Alerts');
</script>
