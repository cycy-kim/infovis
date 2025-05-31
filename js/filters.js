let currentFilters = {
  time_range: [0, 0],
  event_count: [0, 0],
  buy_count: [0, 0],
  cart_value_bucket: [0, 0],
  price_bucket: [0, 0],
  top_n_products: 0,
  min_revenue: 0,
  delay_minutes: [0, 0],
  search_count: [0, 0]
};

let listeners = [];

export function initFilters(data) {
  const root = d3.select("#filters").html("").style("padding", "10px");

  const allTimestamps = [
    ...data.product_buy,
    ...data.add_to_cart,
    ...data.remove_from_cart,
    ...data.search_query
  ].map(d => +new Date(d.timestamp) / 1000);
  const timeMin = d3.min(allTimestamps);
  const timeMax = d3.max(allTimestamps);

  const skuToPrice = new Map(data.product_properties.map(p => [p.sku, p.price]));
  const allPrices = data.product_properties.map(p => p.price);
  const priceMin = d3.min(allPrices);
  const priceMax = d3.max(allPrices);

  const cartPrices = data.add_to_cart
    .map(d => skuToPrice.get(d.sku))
    .filter(p => p !== undefined);
  const cartMin = d3.min(cartPrices);
  const cartMax = d3.max(cartPrices);

  const delays = data.product_buy.map(b => {
    const bt = +new Date(b.timestamp);
    const prev = data.search_query.filter(
      s => s.client_id === b.client_id && +new Date(s.timestamp) < bt
    );
    if (prev.length === 0) return null;
    const lastS = d3.max(prev, s => +new Date(s.timestamp));
    return (bt - lastS) / 60000;
  }).filter(d => d !== null);
  const delayMin = d3.min(delays);
  const delayMax = d3.max(delays);

  const userStats = new Map();
  function count(ds, key) {
    ds.forEach(d => {
      if (!userStats.has(d.client_id)) {
        userStats.set(d.client_id, { add: 0, remove: 0, buy: 0, search: 0 });
      }
      userStats.get(d.client_id)[key]++;
    });
  }
  count(data.add_to_cart, "add");
  count(data.remove_from_cart, "remove");
  count(data.product_buy, "buy");
  count(data.search_query, "search");

  const allStats = Array.from(userStats.values());
  const maxEventCount = d3.max(allStats, d => d.add + d.remove + d.buy + d.search);
  const maxBuyCount = d3.max(allStats, d => d.buy);
  const maxSearchCount = d3.max(allStats, d => d.search);

  const skuSales = new Map();
  data.product_buy.forEach(b => {
    const price = skuToPrice.get(b.sku);
    if (!skuSales.has(b.sku)) {
      skuSales.set(b.sku, { count: 0, price });
    }
    skuSales.get(b.sku).count++;
  });
  const revenueArr = Array.from(skuSales.values()).map(d => d.count * d.price);
  const minRevenue = revenueArr.length > 0 ? d3.min(revenueArr) : 0;

  const topN = new Set(data.product_buy.map(d => d.sku)).size;

  Object.assign(currentFilters, {
    time_range: [timeMin, timeMax],
    event_count: [0, maxEventCount],
    buy_count: [0, maxBuyCount],
    cart_value_bucket: [cartMin, cartMax],
    price_bucket: [priceMin, priceMax],
    top_n_products: topN,
    min_revenue: minRevenue,
    delay_minutes: [delayMin, delayMax],
    search_count: [0, maxSearchCount]
  });

  addSlider(root, "Time Range", "time_range", timeMin, timeMax, 1, false, true);
  addSlider(root, "Event Count", "event_count", 0, maxEventCount, 1);
  addSlider(root, "Buy Count", "buy_count", 0, maxBuyCount, 1);
  addSlider(root, "Price Bucket", "price_bucket", priceMin, priceMax, 1);
  addSlider(root, "Search→Buy Delay (min)", "delay_minutes", delayMin, delayMax, 1, true);
  addSlider(root, "Search Count", "search_count", 0, maxSearchCount, 1);
  addNumber(root, "Top N Products(Price)", "top_n_products");
  addNumber(root, "Min Revenue", "min_revenue");

  notify();
}

function addSlider(root, label, key, min, max, step = 1, fmtFloat = true, fmtTime = false) {
  let fmt;
  if (fmtTime) {
    fmt = v => new Date(v * 1000).toISOString().split("T")[0];
  } else if (fmtFloat) {
    fmt = d3.format(".2f");
  } else {
    fmt = d => d;
  }

  const cur = currentFilters[key];

  const g = root.append("div").attr("class", "filter-group");
  g.append("label").text(label);

  const sliderContainer = g.append("div").style("padding", "20px");
  const sliderDiv = sliderContainer.append("div");

  const span = g.append("span")
    .style("margin-left", "8px")
    .style("font-size", "1.5em")
    .style("font-weight", "500")
    .style("color", "#222");

  noUiSlider.create(sliderDiv.node(), {
    start: [cur[0], cur[1]],
    connect: true,
    range: { min, max },
    step: step,
    tooltips: [false, false],
    format: {
      to: fmt,
      from: Number
    }
  });

  sliderDiv.node().noUiSlider.on('update', (values, handle, unparsed) => {
    currentFilters[key] = unparsed.map(Number);
    span.text(`${fmt(unparsed[0])} ~ ${fmt(unparsed[1])}`);
    notify();
  });
}

function addNumber(root, label, key) {
  const g = root.append("div")
    .attr("class", "filter-group")
    .style("padding", "8px");

  g.append("label")
    .text(label)
    .style("margin-bottom", "6px");

  g.append("input")
    .attr("type", "number")
    .attr("value", currentFilters[key])
    .style("padding", "8px 10px")
    .style("font-size", "1em")
    .style("border", "1px solid #ccc")
    .style("border-radius", "6px")
    .style("background-color", "#fafafa")
    .style("width", "100%")
    .style("box-sizing", "border-box")
    .on("input", function () {
      currentFilters[key] = +this.value;
      notify();
    });
}

export function onFilterChange(cb) {
  listeners.push(cb);
}

export function getCurrentFilters() {
  return { ...currentFilters };
}

function notify() {
  listeners.forEach(cb => cb(getCurrentFilters()));
}
