// server/index.js
// ⚠️ Ceci est un exemple de serveur Node.js avec Express + Supabase
// Tu peux l'adapter selon ton hébergement (Render, Vercel, etc.)

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Utilise la clé service pour le serveur
);

app.use(express.json());
app.use(express.static('public'));

// Edge Function alternative: place-pixel
app.post('/api/place-pixel', async (req, res) => {
  const { x, y, color } = req.body;
  
  // RÃ©cupÃ©rer l'utilisateur depuis le header Authorization
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Non authentifié°º' });
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ success: false, error: 'Token invalide' });
  }

  // Vérifier les pixels de l'utilisateur
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('pixels, last_regen_at')
    .eq('id', user.id)
    .single();

  if (userError || !userData) {
    return res.status(400).json({ success: false, error: 'Utilisateur non trouvé' });
  }

  // Calculer la regen
  const now = new Date();
  const lastRegen = new Date(userData.last_regen_at);
  const hoursPassed = Math.floor((now - lastRegen) / (1000 * 60 * 60));
  const newPixels = Math.min(10, userData.pixels + hoursPassed);

  if (newPixels <= 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'Plus de pixels disponibles' 
    });
  }

  // Poser le pixel
  const { error: pixelError } = await supabase
    .from('pixels')
    .insert({
      x,
      y,
      color,
      user_id: user.id,
    });

  if (pixelError) {
    return res.status(500).json({ success: false, error: 'Erreur base de données' });
  }

  // Mettre à jour l'utilisateur
  await supabase
    .from('users')
    .update({
      pixels: newPixels - 1,
      last_regen_at: now.toISOString(),
    })
    .eq('id', user.id);

  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Serveur The Place by Dimotaga démarré°º sur le port ${PORT}`);
});