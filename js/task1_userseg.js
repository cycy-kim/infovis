export function update(data, filters) {
  const container = d3.select("#task1");
  container.selectAll("*").remove();

  const { product_buy, add_to_cart, remove_from_cart, search_query } = data;
  const { time_range, event_count, buy_count, search_count, delay_minutes } = filters;

  const userStats = new Map();

  function countEvents(dataset, type) {
    dataset.forEach(d => {
      const t = new Date(d.timestamp).getTime() / 1000;
      if (t < time_range[0] || t > time_range[1]) return;
      const id = d.client_id;
      if (!userStats.has(id)) {
        userStats.set(id, {
          client_id: id,
          add: 0, remove: 0, buy: 0, search: 0,
          firstSearch: null, firstBuy: null
        });
      }
      const user = userStats.get(id);
      user[type]++;
      const ts = new Date(d.timestamp).getTime() / 1000;

      if (type === "search") {
        if (user.firstSearch === null || ts < user.firstSearch) {
          user.firstSearch = ts;
        }
      }

      if (type === "buy") {
        if (user.firstBuy === null || ts < user.firstBuy) {
          user.firstBuy = ts;
        }
      }
    });
  }

  countEvents(add_to_cart, 'add');
  countEvents(remove_from_cart, 'remove');
  countEvents(product_buy, 'buy');
  countEvents(search_query, 'search');

  const users = Array.from(userStats.values()).filter(d => {
    const totalEvents = d.add + d.remove + d.buy + d.search;

    let delay = null;
    if (d.firstBuy !== null && d.firstSearch !== null) {
      delay = (d.firstBuy - d.firstSearch) / 60;
    }

    const isEventCountInRange = totalEvents >= event_count[0] && totalEvents <= event_count[1];
    const isBuyCountInRange = d.buy >= buy_count[0] && d.buy <= buy_count[1];
    const isSearchCountInRange = d.search >= search_count[0] && d.search <= search_count[1];
    const isDelayValid = delay === null || (delay >= delay_minutes[0] && delay <= delay_minutes[1]);

    return isEventCountInRange && isBuyCountInRange && isSearchCountInRange && isDelayValid;
  });

  const bounds = container.node().getBoundingClientRect();
  const fullWidth = bounds.width;
  const fullHeight = bounds.height;

  const margin = { top: 30, right: 20, bottom: 60, left: 60 };
  const width = fullWidth - margin.left - margin.right;
  const height = fullHeight - margin.top - margin.bottom;

  const svg = container.append("svg")
    .attr("width", fullWidth)
    .attr("height", fullHeight)
    .call(d3.zoom().scaleExtent([0.5, 10]).on("zoom", (event) => {
      g.attr("transform", event.transform);
    }));

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const maxBuy = d3.max(users, d => Number.isFinite(d.buy) ? d.buy : 0) || 1;
  const maxSearch = d3.max(users, d => Number.isFinite(d.search) ? d.search : 0) || 1;

  const x = d3.scaleLinear().domain([0, maxBuy]).range([0, width]);
  const y = d3.scaleLinear().domain([0, maxSearch]).range([height, 0]);

  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x));

  g.append("g")
    .call(d3.axisLeft(y));

  const tooltip = d3.select("body").append("div")
    .style("position", "absolute")
    .style("z-index", "1000")
    .style("visibility", "hidden")
    .style("background", "#fff")
    .style("border", "1px solid #ccc")
    .style("padding", "6px")
    .style("font-size", "18px")
    .style("pointer-events", "none");

  g.selectAll("circle")
    .data(users)
    .enter()
    .append("circle")
    .attr("cx", d => x(d.buy))
    .attr("cy", d => y(d.search))
    .attr("r", 4)
    .attr("fill", "none")
    .attr("stroke", "steelblue")
    .attr("stroke-opacity", 0.5)
    .on("mouseover", (event, d) => {
      tooltip.style("visibility", "visible")
        .text(`Client ${d.client_id} | Buy: ${d.buy}, Search: ${d.search}`);
      d3.select(event.currentTarget).attr("fill", "orange");
    })
    .on("mousemove", event => {
      tooltip.style("top", (event.pageY + 10) + "px")
        .style("left", (event.pageX + 10) + "px");
    })
    .on("mouseout", event => {
      tooltip.style("visibility", "hidden");
      d3.select(event.currentTarget).attr("fill", "steelblue");
    });

  svg.append("text")
    .attr("x", fullWidth / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .attr("font-weight", "bold")
    .text("User Segmentation: Buy vs Search Frequency");

  svg.append("text")
    .attr("x", fullWidth / 2)
    .attr("y", fullHeight - 10)
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .text("Number of Buy Events");

  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", 15)
    .attr("x", -fullHeight / 2)
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .text("Number of Search Events");
}
