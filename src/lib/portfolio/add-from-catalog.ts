/** Query parameter that opens the portfolio's add form with one catalog coffee chosen. */
export const ADD_FROM_CATALOG_PARAM = 'catalog_id';

/** Where "Add to portfolio" on a catalog coffee leads. */
export function addCatalogCoffeeHref(catalogId: number): string {
	return `/beans?modal=new&${ADD_FROM_CATALOG_PARAM}=${catalogId}`;
}
