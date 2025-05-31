export function update(data, filters) {
  const container = d3.select("#task3");
  container.selectAll("*").remove();

  const tooltip = d3.select("body").append("div")
    .style("position", "absolute")
    .style("background", "white")
    .style("border", "1px solid #ccc")
    .style("padding", "5px")
    .style("display", "none")
    .style("pointer-events", "none");

  const { search_query, product_buy } = data;
  const { time_range, delay_minutes, search_count } = filters;
  const parseTime = ts => new Date(ts).getTime() / 1000;

  const userEvents = new Map();

  const register = (ds, type) => {
    ds.forEach(d => {
      const t = parseTime(d.timestamp);
      if (t < time_range[0] || t > time_range[1]) return;
      const id = d.client_id;
      if (!userEvents.has(id)) {
        userEvents.set(id, { search: [], buy: [] });
      }
      userEvents.get(id)[type].push(t);
    });
  };

  register(search_query, "search");
  register(product_buy, "buy");

  const rows = [];

  userEvents.forEach(ev => {
    if (ev.search.length > 0 && ev.buy.length > 0) {
      const delay = (Math.min(...ev.buy) - Math.min(...ev.search)) / 60;
      const delayValid = delay >= 0 && delay >= delay_minutes[0] && delay <= delay_minutes[1];
      const searchValid = ev.search.length >= search_count[0] && ev.search.length <= search_count[1];

      if (delayValid && searchValid) {
        rows.push({ delay, searchCnt: ev.search.length });
      }
    }
  });

  if (rows.length === 0) {
    container.append("p").style("color", "#888").text("⚠️ No valid data.");
    return;
  }

  const bounds = container.node().getBoundingClientRect();
  const fullWidth = bounds.width;
  let fullHeight = bounds.height;
  if (fullHeight < 100) {
    fullHeight = 300;
  }

  const margin = { top: 40, right: 80, bottom: 70, left: 100 };
  const width = fullWidth - margin.left - margin.right;
  const height = fullHeight - margin.top - margin.bottom;

  const delayBinSize = 4000;
  const maxDelay = d3.max(rows, d => d.delay);
  const delayBins = d3.range(0, maxDelay + delayBinSize, delayBinSize);
  const delayCount = delayBins.length - 1;

  const maxSearch = d3.max(rows, d => d.searchCnt);
  const searchStep = 10;
  const searchBins = d3.range(0, maxSearch + searchStep, searchStep);

  const searchLabels = searchBins.map((v, i) => {
    if (i < searchBins.length - 1) {
      return `${v + 1}-${v + searchStep}`;
    } else {
      return `>${v}`;
    }
  });

  const searchBucket = cnt => {
    for (let i = 0; i < searchBins.length - 1; i++) {
      const lower = searchBins[i] + 1;
      const upper = searchBins[i] + searchStep;
      if (cnt >= lower && cnt <= upper) {
        return `${lower}-${upper}`;
      }
    }
    return `>${searchBins[searchBins.length - 1]}`;
  };

  const cellMap = new Map();
  rows.forEach(r => {
    const dIdx = Math.floor(r.delay / delayBinSize);
    const sLbl = searchBucket(r.searchCnt);
    const key = `${dIdx}|${sLbl}`;
    const prev = cellMap.get(key) || 0;
    cellMap.set(key, prev + 1);
  });

  const svg = container.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand()
    .domain(d3.range(delayCount))
    .range([0, width])
    .padding(0.05);

  const y = d3.scaleBand()
    .domain(searchLabels)
    .range([0, height])
    .padding(0.05);

  const maxCell = d3.max(cellMap.values());
  const color = d3.scaleSequential(d3.interpolateBlues).domain([0, Math.log1p(maxCell)]);

  svg.selectAll("rect")
    .data(cellMap.entries())
    .enter()
    .append("rect")
    .attr("x", d => {
      const dIdx = +d[0].split("|")[0];
      return x(dIdx);
    })
    .attr("y", d => {
      const sLbl = d[0].split("|")[1];
      return y(sLbl);
    })
    .attr("width", Math.max(1, x.bandwidth()))
    .attr("height", Math.max(1, y.bandwidth()))
    .attr("fill", d => color(Math.log1p(d[1])))
    .on("mouseover", function(event, d) {
      const [dIdx, sLbl] = d[0].split("|");
      const dStart = dIdx * delayBinSize;
      const dEnd = dStart + delayBinSize;
      tooltip.style("display", "block")
        .html(`Delay: ${dStart}-${dEnd} min<br>Search count: ${sLbl}<br>Users: ${d[1]}`);
    })
    .on("mousemove", function(event) {
      tooltip.style("left", (event.pageX + 10) + "px")
             .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function() {
      tooltip.style("display", "none");
    });

  const xAxis = d3.axisBottom(x)
    .tickValues(x.domain().filter(i => i % 6 === 0))
    .tickFormat(i => {
      const start = i * delayBinSize;
      const end = (i + 1) * delayBinSize;
      return `${start}-${end}`;
    });

  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(xAxis)
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  svg.append("g").call(d3.axisLeft(y));

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .attr("font-weight", "bold")
    .text("Search → Buy Delay vs Search Count Heat‑map");

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height + 60)
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .text("Delay bucket (minutes)");

  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -80)
    .attr("x", -height / 2)
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .text("Search count bucket");

  const legendHeight = 200;
  const legendWidth = 12;

  const legendSvg = svg.append("g")
    .attr("transform", `translate(${width + 20}, 0)`);

  const legendScale = d3.scaleLinear()
    .domain([0, Math.log1p(maxCell)])
    .range([legendHeight, 0]);

  const legendAxis = d3.axisRight(legendScale)
    .ticks(5)
    .tickFormat(d => Math.round(Math.expm1(d)));

  const legendGradient = legendSvg.append("defs")
    .append("linearGradient")
    .attr("id", "legend-gradient")
    .attr("x1", "0%").attr("y1", "100%")
    .attr("x2", "0%").attr("y2", "0%");

  legendGradient.append("stop")
    .attr("offset", "0%")
    .attr("stop-color", d3.interpolateBlues(0));

  legendGradient.append("stop")
    .attr("offset", "100%")
    .attr("stop-color", d3.interpolateBlues(1));

  legendSvg.append("rect")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .style("fill", "url(#legend-gradient)");

  legendSvg.append("g")
    .attr("transform", `translate(${legendWidth}, 0)`)
    .call(legendAxis);
}
