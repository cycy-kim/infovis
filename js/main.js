import { loadAllData } from './data_loader.js';
import { initFilters, getCurrentFilters, onFilterChange } from './filters.js';
import { update as updateUserSeg } from './task1_userseg.js';
import { update as updatePriceDist } from './task2_price_dist.js';
import { update as updateSearchFlow } from './task3_search_flow.js';

async function init() {
  const loadingElement = document.getElementById('loading');
  loadingElement.style.display = 'block';

  const data = await loadAllData();
  // const summary = await getDatasetSummary(data);
  // console.log(summary);

  loadingElement.style.display = 'none';

  initFilters(data);

  onFilterChange(filters => {
    updateAll(data, filters);
  });

  const currentFilters = getCurrentFilters();
  updateAll(data, currentFilters);
}

function updateAll(data, filters) {
  updateUserSeg(data, filters);
  updatePriceDist(data, filters);
  updateSearchFlow(data, filters);
}

document.addEventListener('DOMContentLoaded', init);
