export interface FontFamily {
  name: string;
  stack: string;
  category: string;
}

export const FONT_CATEGORIES: Record<string, FontFamily[]> = {
  'Sans-Serif': [
    { name: 'Arial', stack: 'Arial, sans-serif', category: 'Sans-Serif' },
    { name: 'Helvetica', stack: 'Helvetica, Arial, sans-serif', category: 'Sans-Serif' },
    { name: 'Inter', stack: "'Inter', sans-serif", category: 'Sans-Serif' },
    { name: 'Roboto', stack: "'Roboto', sans-serif", category: 'Sans-Serif' },
    { name: 'Open Sans', stack: "'Open Sans', sans-serif", category: 'Sans-Serif' },
    { name: 'Lato', stack: "'Lato', sans-serif", category: 'Sans-Serif' },
    { name: 'Montserrat', stack: "'Montserrat', sans-serif", category: 'Sans-Serif' },
    { name: 'Raleway', stack: "'Raleway', sans-serif", category: 'Sans-Serif' },
    { name: 'Poppins', stack: "'Poppins', sans-serif", category: 'Sans-Serif' },
    { name: 'Nunito', stack: "'Nunito', sans-serif", category: 'Sans-Serif' },
    { name: 'Manrope', stack: "'Manrope', sans-serif", category: 'Sans-Serif' },
    { name: 'Oswald', stack: "'Oswald', sans-serif", category: 'Sans-Serif' },
    { name: 'Ubuntu', stack: "'Ubuntu', sans-serif", category: 'Sans-Serif' },
    { name: 'Josefin Sans', stack: "'Josefin Sans', sans-serif", category: 'Sans-Serif' },
    { name: 'Quicksand', stack: "'Quicksand', sans-serif", category: 'Sans-Serif' },
    { name: 'Tahoma', stack: 'Tahoma, sans-serif', category: 'Sans-Serif' },
    { name: 'Verdana', stack: 'Verdana, sans-serif', category: 'Sans-Serif' },
    { name: 'Trebuchet MS', stack: "'Trebuchet MS', sans-serif", category: 'Sans-Serif' },
    { name: 'Century Gothic', stack: "'Century Gothic', sans-serif", category: 'Sans-Serif' },
    { name: 'Gill Sans', stack: "'Gill Sans', 'Gill Sans MT', sans-serif", category: 'Sans-Serif' },
    { name: 'Calibri', stack: "'Calibri', sans-serif", category: 'Sans-Serif' },
    { name: 'Franklin Gothic', stack: "'Franklin Gothic Medium', sans-serif", category: 'Sans-Serif' },
  ],
  'Serif': [
    { name: 'Times New Roman', stack: "'Times New Roman', Times, serif", category: 'Serif' },
    { name: 'Georgia', stack: 'Georgia, serif', category: 'Serif' },
    { name: 'Garamond', stack: 'Garamond, serif', category: 'Serif' },
    { name: 'Palatino Linotype', stack: "'Palatino Linotype', 'Palatino', 'Book Antiqua', serif", category: 'Serif' },
    { name: 'Book Antiqua', stack: "'Book Antiqua', Palatino, serif", category: 'Serif' },
    { name: 'Cambria', stack: 'Cambria, Georgia, serif', category: 'Serif' },
    { name: 'Playfair Display', stack: "'Playfair Display', serif", category: 'Serif' },
    { name: 'Merriweather', stack: "'Merriweather', serif", category: 'Serif' },
    { name: 'Libre Baskerville', stack: "'Libre Baskerville', serif", category: 'Serif' },
    { name: 'Crimson Text', stack: "'Crimson Text', serif", category: 'Serif' },
    { name: 'Bitter', stack: "'Bitter', serif", category: 'Serif' },
    { name: 'EB Garamond', stack: "'EB Garamond', serif", category: 'Serif' },
    { name: 'Noto Serif', stack: "'Noto Serif', serif", category: 'Serif' },
    { name: 'PT Serif', stack: "'PT Serif', serif", category: 'Serif' },
    { name: 'Zilla Slab', stack: "'Zilla Slab', serif", category: 'Serif' },
  ],
  'Monospace': [
    { name: 'Courier New', stack: "'Courier New', Courier, monospace", category: 'Monospace' },
    { name: 'Lucida Console', stack: "'Lucida Console', Monaco, monospace", category: 'Monospace' },
    { name: 'Consolas', stack: "'Consolas', 'Courier New', monospace", category: 'Monospace' },
    { name: 'Source Code Pro', stack: "'Source Code Pro', monospace", category: 'Monospace' },
    { name: 'Fira Code', stack: "'Fira Code', monospace", category: 'Monospace' },
    { name: 'JetBrains Mono', stack: "'JetBrains Mono', monospace", category: 'Monospace' },
    { name: 'Monaco', stack: "'Monaco', Consolas, monospace", category: 'Monospace' },
  ],
  'Display': [
    { name: 'Impact', stack: "Impact, 'Arial Black', sans-serif", category: 'Display' },
    { name: 'Arial Black', stack: "'Arial Black', sans-serif", category: 'Display' },
    { name: 'Bebas Neue', stack: "'Bebas Neue', sans-serif", category: 'Display' },
    { name: 'Anton', stack: "'Anton', sans-serif", category: 'Display' },
    { name: 'Bangers', stack: "'Bangers', sans-serif", category: 'Display' },
    { name: 'Oswald', stack: "'Oswald', sans-serif", category: 'Display' },
  ],
  'Handwriting': [
    { name: 'Comic Sans MS', stack: "'Comic Sans MS', cursive", category: 'Handwriting' },
    { name: 'Dancing Script', stack: "'Dancing Script', cursive", category: 'Handwriting' },
    { name: 'Pacifico', stack: "'Pacifico', cursive", category: 'Handwriting' },
    { name: 'Lobster', stack: "'Lobster', cursive", category: 'Handwriting' },
    { name: 'Caveat', stack: "'Caveat', cursive", category: 'Handwriting' },
    { name: 'Satisfy', stack: "'Satisfy', cursive", category: 'Handwriting' },
    { name: 'Brush Script MT', stack: "'Brush Script MT', cursive", category: 'Handwriting' },
  ],
};

export const ALL_FONTS: FontFamily[] = Object.values(FONT_CATEGORIES).flat();

export function getFontStack(name: string): string {
  return ALL_FONTS.find((f) => f.name === name)?.stack ?? name;
}
