export async function loadAllData() {
  const files = ['add_to_cart.json', 'product_buy.json', 'remove_from_cart.json', 'search_query.json', 'product_properties.json'];
  const data = {};

  await Promise.all(
    files.map(async file => {
      const json = await d3.json(`subset_data/${file}`);
      data[file.replace('.json', '')] = json;
    })
  );

  return data;
}



// export async function getDatasetSummary(data) {
//   const { add_to_cart, product_buy, remove_from_cart, search_query, product_properties } = data;

//   const allEvents = [...add_to_cart, ...product_buy, ...remove_from_cart, ...search_query];

//   const clientIds = new Set(allEvents.map(d => d.client_id));
//   const skus = new Set(product_properties.map(d => d.sku));
//   const categories = new Set(product_properties.map(d => d.category));
//   const urls = new Set(search_query.map(d => d.url).filter(d => d));
//   const eventTypes = new Set([
//     ...add_to_cart.map(() => 'add_to_cart'),
//     ...product_buy.map(() => 'product_buy'),
//     ...remove_from_cart.map(() => 'remove_from_cart'),
//     ...search_query.map(() => 'search_query'),
//   ]);

//   const prices = product_properties.map(d => d.price).sort((a, b) => a - b);
//   const priceBuckets = new Set();
//   const bucketCount = 100;
//   const minPrice = prices[0];
//   const maxPrice = prices[prices.length - 1];
//   const bucketSize = (maxPrice - minPrice) / bucketCount;

//   product_properties.forEach(d => {
//     const bucket = Math.floor((d.price - minPrice) / bucketSize);
//     priceBuckets.add(Math.min(bucket, bucketCount - 1));
//   });

//   return {
//     client_id: clientIds.size,
//     sku: skus.size,
//     category: categories.size,
//     price_bucket: priceBuckets.size,
//     event_type: eventTypes.size,
//     url: urls.size
//   };
// }