<!--
  AccentSpine: the brand's organic tri-color accent, as a vertical spine on
  the left edge of a card. Marks "artifact" cards — insights, briefs, and
  invitations to act — per the organic-accent rules in notes/BRAND.md.

  Usage: parent needs `relative overflow-hidden` and left padding (pl-3 or
  more beyond its base padding). Keep to at most one spined card per view
  region so the accent stays a signal, not wallpaper.
-->
<div class="absolute inset-y-0 left-0 flex w-1.5 flex-col" aria-hidden="true">
	<div class="flex-1 bg-organic-rust"></div>
	<div class="flex-1 bg-organic-gold"></div>
	<div class="flex-1 bg-organic-olive"></div>
</div>
