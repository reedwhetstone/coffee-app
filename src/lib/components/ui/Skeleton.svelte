<script lang="ts">
	let {
		class: className = '',
		rounded = 'rounded',
		height = '',
		width = ''
	} = $props<{
		class?: string;
		rounded?: string;
		height?: string;
		width?: string;
	}>();

	let inlineStyle = $derived(
		[height ? `height:${height}` : '', width ? `width:${width}` : ''].filter(Boolean).join(';')
	);
</script>

<div class="bg-accent {rounded} {className}" style={inlineStyle || undefined}></div>
