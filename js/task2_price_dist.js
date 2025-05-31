export function update(data, filters) {
  const container = d3.select("#task2");
  container.selectAll("*").remove();

  const { product_buy, product_properties } = data;
  const { time_range, price_bucket, min_revenue, top_n_products } = filters;

  const skuToPrice = new Map();
  product_properties.forEach(p => {
    skuToPrice.set(p.sku, p.price);
  });

  const skuSales = new Map();
  product_buy.forEach(d => {
    const t = new Date(d.timestamp).getTime() / 1000;
    const isOutOfRange = t < time_range[0] || t > time_range[1];
    if (isOutOfRange) return;

    const price = skuToPrice.get(d.sku);
    if (price === undefined) return;

    const isPriceOutOfRange = price < price_bucket[0] || price > price_bucket[1];
    if (isPriceOutOfRange) return;

    if (!skuSales.has(d.sku)) {
      skuSales.set(d.sku, { sku: d.sku, count: 0, price });
    }
    const current = skuSales.get(d.sku);
    current.count++;
  });

  const dataArr = Array.from(skuSales.values()).map(d => {
    d.revenue = d.count * d.price;
    return d;
  }).filter(d => d.revenue >= min_revenue);

  const sortedData = dataArr.sort((a, b) => b.price - a.price);
  const limitedData = sortedData.slice(0, top_n_products);

  if (limitedData.length === 0) {
    container.append("p")
      .style("color", "#888")
      .style("margin", "20px")
      .text("⚠️ No products matched current filters.");
    return;
  }

  const bounds = container.node().getBoundingClientRect();
  const fullWidth = bounds.width;
  let fullHeight = bounds.height;

  const isTooShort = fullHeight < 100;
  if (isTooShort) {
    fullHeight = 300;
  }

  const layout = container.append("div")
    .style("display", "flex")
    .style("width", "100%")
    .style("height", "100%");

  const chartArea = layout.append("div")
    .style("flex", "1")
    .style("height", "100%");

  const secondChartArea = layout.append("div")
    .style("flex", "1")
    .style("height", "100%");

  const histMargin = { top: 40, right: 20, bottom: 80, left: 80 };
  const histWidth = fullWidth / 2 - histMargin.left - histMargin.right;
  const histHeight = fullHeight - histMargin.top - histMargin.bottom;

  const histogramData = d3.bin()
    .domain([price_bucket[0], price_bucket[1]])
    .value(d => d.price)
    .thresholds(20)(limitedData);

  const svg = chartArea.append("svg")
    .attr("width", histWidth + histMargin.left + histMargin.right)
    .attr("height", histHeight + histMargin.top + histMargin.bottom)
    .append("g")
    .attr("transform", `translate(${histMargin.left},${histMargin.top})`);

  const x = d3.scaleLinear()
    .domain([0, price_bucket[1]])
    .range([0, histWidth]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(histogramData, d => d3.sum(d, v => v.revenue))])
    .nice()
    .range([histHeight, 0]);

  svg.append("g")
    .attr("transform", `translate(0,${histHeight})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  svg.append("g").call(d3.axisLeft(y));

  const tooltip = d3.select("body").append("div")
    .style("position", "absolute")
    .style("background", "white")
    .style("border", "1px solid #ccc")
    .style("padding", "5px")
    .style("display", "none");

  svg.selectAll("rect")
    .data(histogramData.filter(d => d.x0 >= 0 && d.x1 > d.x0))
    .enter()
    .append("rect")
    .attr("x", d => x(d.x0))
    .attr("y", d => y(d3.sum(d, v => v.revenue)))
    .attr("width", d => {
      const width = x(d.x1) - x(d.x0);
      return width < 1 ? 1 : width;
    })
    .attr("height", d => histHeight - y(d3.sum(d, v => v.revenue)))
    .attr("fill", "#6baed6")
    .style("cursor", "pointer")
    .on("mouseover", function (event, d) {
      const revenue = d3.sum(d, v => v.revenue);
      const count = d.length;
      tooltip.style("display", "block")
        .html(`Price: ${Math.round(d.x0)}~${Math.round(d.x1)}<br>Count: ${count}<br>Revenue: ${revenue}`);
    })
    .on("mousemove", function (event) {
      tooltip.style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function () {
      tooltip.style("display", "none");
    })
    .on("click", function (event, d) {
      svg.selectAll("rect").attr("fill", "#6baed6");
      d3.select(this).attr("fill", "#2171b5");

      const revenueCounts = d3.rollup(d, v => v.length, v => v.revenue);
      const revData = Array.from(revenueCounts, ([revenue, count]) => ({ revenue, count }));

      const secondSvg = secondChartArea.html("").append("svg")
        .attr("width", histWidth + histMargin.left + histMargin.right)
        .attr("height", histHeight + histMargin.top + histMargin.bottom)
        .append("g")
        .attr("transform", `translate(${histMargin.left},${histMargin.top})`);

      const x2 = d3.scaleBand()
        .domain(revData.map(d => d.revenue))
        .range([0, histWidth])
        .padding(0.1);

      const y2 = d3.scaleLinear()
        .domain([0, d3.max(revData, d => d.count)])
        .nice()
        .range([histHeight, 0]);

      secondSvg.append("g")
        .attr("transform", `translate(0,${histHeight})`)
        .call(d3.axisBottom(x2).tickFormat(d => `$${d}`));

      secondSvg.append("g")
        .call(d3.axisLeft(y2));

      secondSvg.selectAll("rect")
        .data(revData)
        .enter()
        .append("rect")
        .attr("x", d => x2(d.revenue))
        .attr("y", d => y2(d.count))
        .attr("width", x2.bandwidth())
        .attr("height", d => histHeight - y2(d.count))
        .attr("fill", "#fd8d3c")
        .append("title")
        .text(d => `Revenue: ${d.revenue}\nCount: ${d.count}`);

      secondSvg.append("text")
        .attr("x", histWidth / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .attr("font-weight", "bold")
        .text("Revenue Distribution for Selected Bin");
    });

  svg.append("text")
    .attr("x", histWidth / 2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .attr("font-weight", "bold")
    .text("Price Buckets vs Revenue");
}
