const API = 'https://www.themealdb.com/api/json/v1/1';
const LS_PLAN = 'meal_plan';
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

const categorySelect     = document.getElementById('categorySelect');
const areaSelect         = document.getElementById('areaSelect');
const surpriseBtn        = document.getElementById('surpriseBtn');
const breakfastBtn = document.getElementById('breakfastBtn');
const loader             = document.getElementById('loader');
const errorDiv           = document.getElementById('error');
const mealCard           = document.getElementById('mealCard');
const mealImage          = document.getElementById('mealImage');
const mealName           = document.getElementById('mealName');
const mealCategory       = document.getElementById('mealCategory');
const mealArea           = document.getElementById('mealArea');
const mealTags           = document.getElementById('mealTags');
const ingredientsList    = document.getElementById('ingredients');
const instructionsDiv    = document.getElementById('instructions');
const toggleInstructions = document.getElementById('toggleInstructions');
const ytBtn              = document.getElementById('ytBtn');
const dayBtns            = document.querySelectorAll('.day-btn');
const planSection        = document.getElementById('planSection');
const planGrid           = document.getElementById('planGrid');
const clearPlanBtn       = document.getElementById('clearPlanBtn');

let currentMeal = null;

// ── Loader / Error ──────────────────────────────────────────────
function showLoader(on) {
  loader.hidden = !on;
  surpriseBtn.disabled = on;
  categorySelect.disabled = on;
  areaSelect.disabled = on;
}
function showError(msg) { errorDiv.textContent = msg; errorDiv.hidden = false; }
function clearError()   { errorDiv.hidden = true; }

// ── Bootstrap filters ────────────────────────────────────────────
async function loadFilters() {
  try {
    const [catRes, areaRes] = await Promise.all([
      fetch(`${API}/categories.php`),
      fetch(`${API}/list.php?a=list`)
    ]);
    const catData  = await catRes.json();
    const areaData = await areaRes.json();

    catData.categories.forEach(c => {
      const o = document.createElement('option');
      o.value = c.strCategory;
      o.textContent = c.strCategory;
      categorySelect.appendChild(o);
    });

    areaData.meals.forEach(a => {
      const o = document.createElement('option');
      o.value = a.strArea;
      o.textContent = a.strArea;
      areaSelect.appendChild(o);
    });
  } catch { /* filters are optional */ }
}

// ── Fetch random / filtered meal ─────────────────────────────────
async function fetchMeal() {
  const cat  = categorySelect.value;
  const area = areaSelect.value;

  // If filters are selected, first get a filtered list then pick randomly
  if (cat || area) {
    const params = cat ? `c=${cat}` : `a=${area}`;
    const res  = await fetch(`${API}/filter.php?${params}`);
    const data = await res.json();
    if (!data.meals) throw new Error('No meals found for this filter.');

    const pick = data.meals[Math.floor(Math.random() * data.meals.length)];
    const detailRes  = await fetch(`${API}/lookup.php?i=${pick.idMeal}`);
    const detailData = await detailRes.json();
    return detailData.meals[0];
  }

  // Pure random
  const res  = await fetch(`${API}/random.php`);
  const data = await res.json();
  return data.meals[0];
}

// ── Render meal ──────────────────────────────────────────────────
function renderMeal(meal) {
  currentMeal = meal;

  mealImage.src = meal.strMealThumb;
  mealImage.alt = meal.strMeal;
  mealName.textContent = meal.strMeal;
  mealCategory.textContent = meal.strCategory || '';
  mealArea.textContent = meal.strArea || '';
  mealArea.hidden = !meal.strArea;

  // Tags
  mealTags.innerHTML = '';
  if (meal.strTags) {
    meal.strTags.split(',').filter(Boolean).forEach(tag => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = tag.trim();
      mealTags.appendChild(span);
    });
  }

  // Ingredients
  ingredientsList.innerHTML = '';
  for (let i = 1; i <= 20; i++) {
    const ing     = meal[`strIngredient${i}`];
    const measure = meal[`strMeasure${i}`];
    if (!ing || !ing.trim()) break;
    const li = document.createElement('li');
    li.innerHTML = `${ing} <span class="ing-measure">${measure ? measure.trim() : ''}</span>`;
    ingredientsList.appendChild(li);
  }

  // Instructions
  instructionsDiv.textContent = meal.strInstructions || '';
  instructionsDiv.hidden = true;
  toggleInstructions.textContent = 'Show';

  // YouTube
  if (meal.strYoutube) {
    ytBtn.href = meal.strYoutube;
    ytBtn.hidden = false;
  } else {
    ytBtn.hidden = true;
  }

  // Day buttons — mark days that already have this meal
  updateDayBtns();

  mealCard.hidden = false;
}

// ── Surprise me ──────────────────────────────────────────────────
async function surprise() {
  clearError();
  mealCard.hidden = true;
  showLoader(true);
  try {
    const meal = await fetchMeal();
    renderMeal(meal);
  } catch (err) {
    showError(err.message || 'Could not load a meal. Please try again.');
  } finally {
    showLoader(false);
  }
}

// ── Instructions toggle ──────────────────────────────────────────
toggleInstructions.addEventListener('click', () => {
  const hidden = instructionsDiv.hidden;
  instructionsDiv.hidden = !hidden;
  toggleInstructions.textContent = hidden ? 'Hide' : 'Show';
});

// ── Weekly Plan ──────────────────────────────────────────────────
function getPlan() {
  return JSON.parse(localStorage.getItem(LS_PLAN) || '{}');
}
function savePlan(plan) {
  localStorage.setItem(LS_PLAN, JSON.stringify(plan));
}

function updateDayBtns() {
  const plan = getPlan();
  dayBtns.forEach(btn => {
    const day = btn.dataset.day;
    const saved = plan[day] && currentMeal && plan[day].id === currentMeal.idMeal;
    btn.classList.toggle('saved', !!saved);
    btn.title = saved ? 'Remove from this day' : `Add to ${day}`;
  });
}

dayBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    if (!currentMeal) return;
    const plan = getPlan();
    const day  = btn.dataset.day;
    if (plan[day] && plan[day].id === currentMeal.idMeal) {
      delete plan[day];
    } else {
      plan[day] = {
        id:    currentMeal.idMeal,
        name:  currentMeal.strMeal,
        thumb: currentMeal.strMealThumb
      };
    }
    savePlan(plan);
    updateDayBtns();
    renderPlan();
  });
});

function renderPlan() {
  const plan = getPlan();
  const hasMeals = Object.keys(plan).length > 0;
  planSection.hidden = !hasMeals;
  planGrid.innerHTML = '';

  DAYS.forEach(day => {
    const slot = document.createElement('div');
    slot.className = 'plan-slot';

    const label = document.createElement('div');
    label.className = 'plan-day';
    label.textContent = day;
    slot.appendChild(label);

    if (plan[day]) {
      const img = document.createElement('img');
      img.className = 'plan-meal-img';
      img.src = plan[day].thumb;
      img.alt = plan[day].name;
      slot.appendChild(img);

      const name = document.createElement('div');
      name.className = 'plan-meal-name';
      name.textContent = plan[day].name;
      slot.appendChild(name);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'plan-remove';
      removeBtn.textContent = '✕';
      removeBtn.title = 'Remove';
      removeBtn.addEventListener('click', () => {
        const p = getPlan();
        delete p[day];
        savePlan(p);
        updateDayBtns();
        renderPlan();
      });
      slot.appendChild(removeBtn);
    } else {
      const empty = document.createElement('div');
      empty.className = 'plan-empty';
      empty.textContent = 'empty';
      slot.appendChild(empty);
    }

    planGrid.appendChild(slot);
  });
}

clearPlanBtn.addEventListener('click', () => {
  savePlan({});
  updateDayBtns();
  renderPlan();
});

// ── Filter change ────────────────────────────────────────────────
categorySelect.addEventListener('change', () => { areaSelect.value = ''; surprise(); });
areaSelect.addEventListener('change', () => { categorySelect.value = ''; surprise(); });
surpriseBtn.addEventListener('click', surprise);

breakfastBtn.addEventListener('click', () => {
  categorySelect.value = 'Breakfast';
  areaSelect.value = '';
  surprise();
});

// ── Init ─────────────────────────────────────────────────────────
loadFilters();
renderPlan();
surprise();
