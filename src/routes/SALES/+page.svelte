<script context="module" lang="ts">
	export interface SaleData {
		id: number;
		green_coffee_inv_id: number;
		oz_sold: number;
		price: number;
		buyer: string;
		batch_name: string;
		sell_date: string;
		purchase_date: string;
		coffee_name?: string;
		roast_date?: string;
	}

	export interface SaleFormProps {
		sale: SaleData | null;
		onClose: () => void;
		onSubmit: (sale: SaleData) => void;
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import SalesTable from './SalesTable.svelte';
	import SaleForm from '../SALES/SaleForm.svelte';
	import { navbarActions } from '$lib/stores/navbarStore';
	import { get } from 'svelte/store';

	let resizeObserver: ResizeObserver;
	let salesData: SaleData[] = [];
	let chartContainer: HTMLDivElement;
	let svg: d3.Selection<SVGGElement, unknown, null, undefined>;
	let margin = { top: 20, right: 20, bottom: 50, left: 60 };
	let width: number;
	let height = 400;
	let isFormVisible = false;
	let selectedSale: SaleData | null = null;

	onMount(() => {
		(async () => {
			try {
				const response = await fetch('/api/sales');
				if (response.ok) {
					salesData = await response.json();
					createChart();
				}

				// Create resize observer
				resizeObserver = new ResizeObserver(() => {
					if (chartContainer) {
						createChart();
					}
				});

				resizeObserver.observe(chartContainer);

				navbarActions.set({
					...get(navbarActions),
					onAddNewSale: () => (isFormVisible = true)
				});
			} catch (error) {
				console.error('Error fetching sales data:', error);
			}
		})();

		return () => {
			if (resizeObserver) {
				resizeObserver.disconnect();
			}
			navbarActions.set({
				...get(navbarActions),
				onAddNewSale: () => {}
			});
		};
	});

	function createChart() {
		// Get the container width
		width = chartContainer.clientWidth - margin.left - margin.right;

		// Clear existing chart
		d3.select(chartContainer).selectAll('*').remove();

		// Create SVG
		svg = d3
			.select(chartContainer)
			.append('svg')
			.attr('width', '100%')
			.attr('height', height + margin.top + margin.bottom)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		// Create scales
		const xScale = d3
			.scaleTime()
			.domain(d3.extent(salesData, (d) => new Date(d.sell_date)) as [Date, Date])
			.range([0, width]);
		// set the price range in the chart with math.max to N
		const yScale = d3
			.scaleLinear()
			.domain([0, Math.max(21, d3.max(salesData, (d) => d.price) || 0)])
			.range([height, 0]);

		// Create axes with white text
		const xAxis = d3.axisBottom(xScale).tickFormat((d) => (d as Date).toLocaleDateString());
		const yAxis = d3.axisLeft(yScale).tickFormat((d) => `$${d}`);

		// Add axes to chart with white text styling
		svg
			.append('g')
			.attr('transform', `translate(0,${height})`)
			.call(xAxis)
			.attr('color', 'white')
			.selectAll('text')
			.style('fill', 'white');

		svg.append('g').call(yAxis).attr('color', 'white').selectAll('text').style('fill', 'white');

		// Add sales points
		svg
			.selectAll('circle')
			.data(salesData)
			.enter()
			.append('circle')
			.attr('cx', (d) => xScale(new Date(d.sell_date)))
			.attr('cy', (d) => yScale(d.price))
			.attr('r', 5)
			.attr('fill', '#3730a3')
			.on('mouseover', function (event, d) {
				showTooltip(event, d);
			})
			.on('mouseout', hideTooltip);
	}

	function showTooltip(event: MouseEvent, d: SaleData) {
		const tooltip = d3
			.select('body')
			.append('div')
			.attr('class', 'tooltip')
			.style('position', 'absolute')
			.style('background', '#1f2937')
			.style('padding', '10px')
			.style('border-radius', '5px')
			.style('color', 'white')
			.style('font-size', '12px');

		tooltip
			.html(
				`
            <div>
                <strong>Batch:</strong> ${d.batch_name}<br>
                <strong>Coffee:</strong> ${d.coffee_name || 'N/A'}<br>
                <strong>Buyer:</strong> ${d.buyer}<br>
                <strong>Amount:</strong> ${d.oz_sold}oz<br>
                <strong>Price:</strong> $${d.price}<br>
                <strong>Sale Date:</strong> ${new Date(d.sell_date).toLocaleDateString()}
            </div>
        `
			)
			.style('left', event.pageX + 10 + 'px')
			.style('top', event.pageY - 10 + 'px');
	}

	function hideTooltip() {
		d3.select('.tooltip').remove();
	}

	async function handleFormSubmit(saleData: any) {
		try {
			// Make the actual create/update request first
			const response = await fetch(`/api/sales${selectedSale ? `?id=${selectedSale.id}` : ''}`, {
				method: selectedSale ? 'PUT' : 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(saleData)
			});

			if (!response.ok) {
				throw new Error(`Failed to ${selectedSale ? 'update' : 'create'} sale`);
			}

			// After successful create/update, fetch the updated sales data
			const refreshResponse = await fetch('/api/sales');
			if (refreshResponse.ok) {
				salesData = await refreshResponse.json();
				createChart();
			}
		} catch (error) {
			console.error('Error updating sales data:', error);
		}
		isFormVisible = false;
		selectedSale = null;
	}

	function handleEdit(sale: SaleData) {
		selectedSale = sale;
		isFormVisible = true;
	}

	async function handleDelete(id: number) {
		try {
			const response = await fetch('/api/sales');
			if (response.ok) {
				salesData = await response.json();
				createChart();
			}
		} catch (error) {
			console.error('Error updating sales data:', error);
		}
	}
</script>

<!-- Add the form modal -->
{#if isFormVisible}
	<div class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75">
		<div class="w-full max-w-2xl rounded-lg bg-zinc-800 p-6">
			<SaleForm
				sale={selectedSale}
				onClose={() => {
					isFormVisible = false;
					selectedSale = null;
				}}
				onSubmit={handleFormSubmit}
			/>
		</div>
	</div>
{/if}

<div class="m-8">
	<h1 class="mb-4 text-2xl font-bold text-zinc-400">Sales Overview</h1>
	<div class="w-full rounded-lg bg-zinc-800 p-6">
		<div bind:this={chartContainer} class="w-full"></div>
	</div>

	<SalesTable {salesData} onEdit={handleEdit} onDelete={handleDelete} />
</div>
