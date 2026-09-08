-- The Place by Dimotaga - Sché°ºma de base de données Supabase

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,              -- Discord user ID (via Supabase Auth)
  username TEXT NOT NULL,
  avatar_url TEXT,
  pixels INTEGER DEFAULT 10 CHECK (pixels >= 0 AND pixels <= 10),
  last_regen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des pixels posé°ºs
CREATE TABLE IF NOT EXISTS pixels (
  id SERIAL PRIMARY KEY,
  x INTEGER NOT NULL CHECK (x >= 0 AND x < 50),
  y INTEGER NOT NULL CHECK (y >= 0 AND y < 50),
  color TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_pixels_xy ON pixels(x, y);
CREATE INDEX IF NOT EXISTS idx_pixels_user ON pixels(user_id);

-- Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pixels ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs peuvent voir tous les users (pour affichage)
CREATE POLICY "Voir tous les utilisateurs"
  ON users FOR SELECT
  USING (true);

-- Les utilisateurs ne peuvent modifier que leur propre ligne
CREATE POLICY "Modifier son propre utilisateur"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Tout le monde peut voir les pixels
CREATE POLICY "Voir tous les pixels"
  ON pixels FOR SELECT
  USING (true);

-- Seuls les utilisateurs connecté°ºs peuvent insé°ºrer des pixels
CREATE POLICY "Insé°ºrer des pixels (authentifié°º)"
  ON pixels FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Fonction pour créer un utilisateur automatiquement à la connexion
-- (optionnel, à appeler depuis ton code ou via un trigger)
CREATE OR REPLACE FUNCTION create_user_if_not_exists()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, username, avatar_url, pixels, last_regen_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Unknown'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    10,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour créer l'utilisateur après inscription
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_if_not_exists();