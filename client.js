(() => {
  const SUPABASE_URL = 'https://wgoyfhebueoynhwmmvuc.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb3lmaGVidWVveW5od21tdnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MTExNzEsImV4cCI6MjEwNDM4NzE3MX0.aljvQ6mWGJqIz7gFhhMLCOnoOI12T1MODSILDpbVoFo';

  const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );

  const GRID_SIZE = 200;
  const MAX_PIXELS = 10;
  const REGEN_MS = 2 * 1000;

  const COLORS = [
    '#FFFFFF',
    '#6B7280',
    '#000000',
    '#8B4513',
    '#FF4500',
    '#FF8A00',
    '#FFD635',
    '#00A83B',
    '#7EED56',
    '#00AFC0',
    '#3690EA',
    '#8B5CF6',
  ];

  let selectedColor = COLORS[0];
  let currentUser = null;
  let profile = null;

  let dragging = false;
  let didMove = false;
  let lastX = 0;
  let lastY = 0;

  let zoom = 1;
  let offsetX = 0;
  let offsetY = 0;

  const pixels = new Map();

  const canvas = document.getElementById('place-canvas');
  const ctx = canvas.getContext('2d');

  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const userInfo = document.getElementById('user-info');
  const userAvatar = document.getElementById('user-avatar');
  const usernameEl = document.getElementById('username');
  const pixelsCountEl = document.getElementById('pixels-count');
  const colorsPanel = document.getElementById('colors-panel');
  const colorsGrid = document.getElementById('colors-grid');
  const cooldownMsg = document.getElementById('cooldown-msg');
  const zoomOutBtn = document.getElementById('zoom-out-btn');
  const zoomInBtn = document.getElementById('zoom-in-btn');
  const resetViewBtn = document.getElementById('reset-view-btn');
  const zoomLevel = document.getElementById('zoom-level');

  if (!window.supabase) {
    console.error('Supabase CDN non chargé.');
    alert('Supabase ne se charge pas. Vérifie la balise script dans index.html.');
    return;
  }

  if (!canvas || !ctx) {
    console.error('Canvas introuvable.');
    return;
  }

  function getDisplaySize() {
    const rect = canvas.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
    };
  }

  function getBoardSize() {
    const { width } = getDisplaySize();
    return width * zoom;
  }

  function syncCanvasResolution() {
    const rect = canvas.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;

    const targetWidth = Math.round(rect.width * pixelRatio);
    const targetHeight = Math.round(rect.height * pixelRatio);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function resetView() {
    const { width, height } = getDisplaySize();

    zoom = 1;
    offsetX = (width - width) / 2;
    offsetY = (height - width) / 2;

    render();
  }

  function render() {
    syncCanvasResolution();

    const { width, height } = getDisplaySize();
    const boardSize = getBoardSize();
    const cellSize = boardSize / GRID_SIZE;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(offsetX, offsetY);

    ctx.fillStyle = '#080812';
    ctx.fillRect(0, 0, boardSize, boardSize);

    pixels.forEach((color, key) => {
      const [x, y] = key.split(',').map(Number);

      ctx.fillStyle = color;
      ctx.fillRect(
        x * cellSize,
        y * cellSize,
        Math.ceil(cellSize),
        Math.ceil(cellSize)
      );
    });

    if (cellSize >= 4) {
      const startX = Math.max(0, Math.floor(-offsetX / cellSize));
      const endX = Math.min(GRID_SIZE, Math.ceil((width - offsetX) / cellSize));
      const startY = Math.max(0, Math.floor(-offsetY / cellSize));
      const endY = Math.min(GRID_SIZE, Math.ceil((height - offsetY) / cellSize));

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();

      for (let x = startX; x <= endX; x += 1) {
        ctx.moveTo(x * cellSize, startY * cellSize);
        ctx.lineTo(x * cellSize, endY * cellSize);
      }

      for (let y = startY; y <= endY; y += 1) {
        ctx.moveTo(startX * cellSize, y * cellSize);
        ctx.lineTo(endX * cellSize, y * cellSize);
      }

      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(113, 104, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, boardSize, boardSize);

    ctx.restore();

    zoomLevel.textContent = `${Math.round(zoom * 100)}%`;
  }

  function createColorButtons() {
    colorsGrid.innerHTML = '';

    COLORS.forEach((color, index) => {
      const button = document.createElement('button');

      button.type = 'button';
      button.className = `color-btn${index === 0 ? ' selected' : ''}`;
      button.style.backgroundColor = color;
      button.title = `Couleur ${index + 1}`;
      button.setAttribute('aria-label', `Choisir la couleur ${index + 1}`);

      button.addEventListener('click', () => {
        selectedColor = color;

        document.querySelectorAll('.color-btn').forEach((item) => {
          item.classList.remove('selected');
        });

        button.classList.add('selected');
      });

      colorsGrid.appendChild(button);
    });
  }

  function getRegeneratedProfile(localProfile) {
    if (!localProfile?.last_regen_at) return localProfile;

    const lastRegen = new Date(localProfile.last_regen_at).getTime();

    if (Number.isNaN(lastRegen)) {
      return localProfile;
    }

    const gained = Math.floor((Date.now() - lastRegen) / REGEN_MS);

    if (gained <= 0 || localProfile.pixels >= MAX_PIXELS) {
      return localProfile;
    }

    return {
      ...localProfile,
      pixels: Math.min(MAX_PIXELS, localProfile.pixels + gained),
      last_regen_at: new Date(lastRegen + gained * REGEN_MS).toISOString(),
    };
  }

  async function refreshPixels() {
    if (!profile || !currentUser) return;

    const regenerated = getRegeneratedProfile(profile);

    if (
      regenerated.pixels !== profile.pixels ||
      regenerated.last_regen_at !== profile.last_regen_at
    ) {
      const { data, error } = await supabaseClient
        .from('profiles')
        .update({
          pixels: regenerated.pixels,
          last_regen_at: regenerated.last_regen_at,
        })
        .eq('id', currentUser.id)
        .select('id, username, avatar_url, pixels, last_regen_at, created_at')
        .single();

      if (error) {
        console.error('Erreur régénération des pixels :', error);
      } else if (data) {
        profile = data;
      }
    }

    pixelsCountEl.textContent = `Pixels : ${profile.pixels}/${MAX_PIXELS}`;

    if (profile.pixels > 0) {
      cooldownMsg.classList.add('hidden');
      return;
    }

    const nextAt = new Date(
      new Date(profile.last_regen_at).getTime() + REGEN_MS
    );

    const remaining = Math.max(0, nextAt.getTime() - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    cooldownMsg.textContent =
      `Plus de pixels. Prochain pixel dans ${minutes} min ` +
      `${String(seconds).padStart(2, '0')} s.`;

    cooldownMsg.classList.remove('hidden');
  }

  async function loadBoard() {
  const PAGE_SIZE = 1000;
  const allPixels = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabaseClient
      .from('board_pixels')
      .select('x, y, color')
      .gte('x', 0)
      .lte('x', GRID_SIZE - 1)
      .gte('y', 0)
      .lte('y', GRID_SIZE - 1)
      .order('x', { ascending: true })
      .order('y', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error('Impossible de charger le plateau :', error);
      alert(`Erreur de chargement du plateau : ${error.message}`);
      return;
    }

    if (!data || data.length === 0) {
      break;
    }

    allPixels.push(...data);

    if (data.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  const nextPixels = new Map();

  allPixels.forEach((pixel) => {
    if (
      Number.isInteger(pixel.x) &&
      Number.isInteger(pixel.y) &&
      typeof pixel.color === 'string'
    ) {
      nextPixels.set(`${pixel.x},${pixel.y}`, pixel.color);
    }
  });

  pixels.clear();

  nextPixels.forEach((color, key) => {
    pixels.set(key, color);
  });

  console.log(`Plateau chargé : ${pixels.size} pixels`);
  render();
}

  async function createOrLoadProfile(user) {
    const { data: existing, error } = await supabaseClient
      .from('profiles')
      .select('id, username, avatar_url, pixels, last_regen_at, created_at')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;

    if (existing) return existing;

    const metadata = user.user_metadata || {};

    const username =
      metadata.full_name ||
      metadata.name ||
      metadata.user_name ||
      'Joueur';

    const { data: created, error: createError } = await supabaseClient
      .from('profiles')
      .insert({
        id: user.id,
        username,
        avatar_url: metadata.avatar_url || '',
        pixels: MAX_PIXELS,
        last_regen_at: new Date().toISOString(),
      })
      .select('id, username, avatar_url, pixels, last_regen_at, created_at')
      .single();

    if (createError) throw createError;

    return created;
  }

  async function loadSession() {
    const {
      data: { session },
      error,
    } = await supabaseClient.auth.getSession();

    if (error) {
      console.error('Erreur de session :', error);
    }

    if (!session) {
      loginBtn.classList.remove('hidden');
      userInfo.classList.add('hidden');
      colorsPanel.classList.add('hidden');
      return;
    }

    currentUser = session.user;

    try {
      profile = await createOrLoadProfile(currentUser);
    } catch (error) {
      console.error('Erreur de profil :', error);
      alert(`Erreur de profil : ${error.message}`);
      return;
    }

    const metadata = currentUser.user_metadata || {};

    usernameEl.textContent = profile.username || 'Joueur';
    userAvatar.src =
      profile.avatar_url ||
      metadata.avatar_url ||
      'https://placehold.co/80x80/5865f2/ffffff?text=D';

    loginBtn.classList.add('hidden');
    userInfo.classList.remove('hidden');
    colorsPanel.classList.remove('hidden');

    await refreshPixels();
  }

  function getCell(event) {
    const rect = canvas.getBoundingClientRect();
    const boardSize = getBoardSize();
    const cellSize = boardSize / GRID_SIZE;

    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;

    const x = Math.floor((pointerX - offsetX) / cellSize);
    const y = Math.floor((pointerY - offsetY) / cellSize);

    if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) {
      return null;
    }

    return { x, y };
  }

  async function placePixel(event) {
    if (!currentUser || !profile) {
      alert('Connecte-toi avec Discord pour poser un pixel.');
      return;
    }

    await refreshPixels();

    if (profile.pixels <= 0) {
      return;
    }

    const cell = getCell(event);

    if (!cell) {
      console.warn('Clic hors de la grille.');
      return;
    }

    const now = new Date().toISOString();

    const { error: pixelError } = await supabaseClient
      .from('board_pixels')
      .upsert(
        {
          x: cell.x,
          y: cell.y,
          color: selectedColor,
          user_id: currentUser.id,
          updated_at: now,
        },
        { onConflict: 'x,y' }
      );

    if (pixelError) {
      console.error('Erreur lors du placement du pixel :', pixelError);
      alert(`Impossible de poser le pixel : ${pixelError.message}`);
      return;
    }

    const { data: updatedProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .update({
        pixels: Math.max(0, profile.pixels - 1),
        last_regen_at: now,
      })
      .eq('id', currentUser.id)
      .select('id, username, avatar_url, pixels, last_regen_at, created_at')
      .single();

    if (profileError || !updatedProfile) {
      console.error('Erreur de mise à jour du stock :', profileError);
      alert(
        `Pixel posé, mais erreur de stock : ${
          profileError?.message || 'inconnue'
        }`
      );
      return;
    }

    profile = updatedProfile;
    pixels.set(`${cell.x},${cell.y}`, selectedColor);

    render();
    await refreshPixels();
  }

  function zoomAt(nextZoom, clientX, clientY) {
    const rect = canvas.getBoundingClientRect();

    const pointX =
      clientX === undefined ? rect.width / 2 : clientX;

    const pointY =
      clientY === undefined ? rect.height / 2 : clientY;

    const worldX = (pointX - offsetX) / zoom;
    const worldY = (pointY - offsetY) / zoom;

    zoom = Math.max(0.5, Math.min(12, nextZoom));

    offsetX = pointX - worldX * zoom;
    offsetY = pointY - worldY * zoom;

    render();
  }

  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();

      const rect = canvas.getBoundingClientRect();
      const factor = event.deltaY < 0 ? 1.2 : 0.83;

      zoomAt(
        zoom * factor,
        event.clientX - rect.left,
        event.clientY - rect.top
      );
    },
    { passive: false }
  );

  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture(event.pointerId);

    dragging = true;
    didMove = false;

    lastX = event.clientX;
    lastY = event.clientY;

    canvas.classList.add('dragging');
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;

    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      didMove = true;
    }

    if (didMove) {
      offsetX += dx;
      offsetY += dy;
      render();
    }

    lastX = event.clientX;
    lastY = event.clientY;
  });

  canvas.addEventListener('pointerup', async (event) => {
    if (!dragging) return;

    dragging = false;
    canvas.classList.remove('dragging');

    if (!didMove) {
      await placePixel(event);
    }
  });

  canvas.addEventListener('pointercancel', () => {
    dragging = false;
    didMove = false;
    canvas.classList.remove('dragging');
  });

  zoomOutBtn.addEventListener('click', () => {
    zoomAt(zoom / 1.4);
  });

  zoomInBtn.addEventListener('click', () => {
    zoomAt(zoom * 1.4);
  });

  resetViewBtn.addEventListener('click', resetView);

  loginBtn.addEventListener('click', async () => {
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      console.error('Erreur OAuth Discord :', error);
      alert(`Erreur Discord : ${error.message}`);
    }
  });

  logoutBtn.addEventListener('click', async () => {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      console.error('Erreur de déconnexion :', error);
    }

    window.location.reload();
  });

  supabaseClient
    .channel('the-place-board')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'board_pixels',
      },
      (payload) => {
        const pixel = payload.new;

        if (pixel?.x !== undefined && pixel?.y !== undefined) {
          pixels.set(`${pixel.x},${pixel.y}`, pixel.color);
          render();
        }
      }
    )
    .subscribe((status) => {
      console.log('Realtime board status :', status);
    });

  window.addEventListener('resize', render);

  createColorButtons();
  resetView();
  loadBoard();
  loadSession();

  setInterval(refreshPixels, 1000);
})();