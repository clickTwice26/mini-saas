import { createTheme } from '@mui/material/styles';

// Material Design 3 (M3) Professional, Crisp & Minimalist Dark Theme
export const m3Theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#38bdf8', // Electric Cyan
      light: '#7dd3fc',
      dark: '#0284c7',
      contrastText: '#030712'
    },
    secondary: {
      main: '#a78bfa', // M3 Violet Accent
      light: '#c4b5fd',
      dark: '#7c3aed',
      contrastText: '#030712'
    },
    success: {
      main: '#34d399', // Emerald 400
      light: '#6ee7b7',
      dark: '#059669',
      contrastText: '#030712'
    },
    error: {
      main: '#fb7185', // Rose 400
      light: '#fda4af',
      dark: '#e11d48',
      contrastText: '#ffffff'
    },
    warning: {
      main: '#fbbf24', // Amber 400
      light: '#fde68a',
      dark: '#d97706',
      contrastText: '#030712'
    },
    background: {
      default: '#080c16', // Deep M3 Canvas Surface
      paper: '#0f172a'    // M3 Surface Container
    },
    text: {
      primary: '#f8fafc',
      secondary: '#94a3b8'
    },
    divider: 'rgba(148, 163, 184, 0.12)'
  },
  shape: {
    borderRadius: 8 // Reduced, crisp modern radius
  },
  typography: {
    fontFamily: [
      'Plus Jakarta Sans',
      'Outfit',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      'sans-serif'
    ].join(','),
    button: {
      textTransform: 'none',
      fontWeight: 600,
      letterSpacing: '0.01em'
    },
    h1: { fontWeight: 800 },
    h2: { fontWeight: 800 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 }
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#080c16',
          color: '#f8fafc',
          overflowX: 'hidden',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(148, 163, 184, 0.2) transparent',
          '&::-webkit-scrollbar': {
            width: '6px',
            height: '6px'
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(148, 163, 184, 0.2)',
            borderRadius: '4px'
          }
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8, // Crisp professional corners
          padding: '6px 16px',
          boxShadow: 'none',
          transition: 'all 0.15s ease-in-out',
          '&:hover': {
            boxShadow: 'none',
            transform: 'translateY(-1px)'
          }
        }
      }
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 8, // Crisp corners
          border: '1px solid rgba(148, 163, 184, 0.12)',
          background: 'rgba(15, 23, 42, 0.6)',
          color: '#94a3b8',
          transition: 'all 0.15s ease',
          '&:hover': {
            background: 'rgba(56, 189, 248, 0.12)',
            color: '#38bdf8',
            borderColor: 'rgba(56, 189, 248, 0.3)'
          }
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#0f172a',
          border: '1px solid rgba(148, 163, 184, 0.1)',
          borderRadius: 10
        }
      }
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          border: '1px solid rgba(56, 189, 248, 0.2)',
          backgroundColor: 'rgba(11, 17, 32, 0.96)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)'
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6, // Crisp rectangular chip with slight rounding
          fontWeight: 600,
          fontSize: '0.75rem'
        }
      }
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#1e293b',
          color: '#f8fafc',
          border: '1px solid rgba(148, 163, 184, 0.15)',
          borderRadius: 6,
          fontSize: '0.75rem',
          padding: '5px 10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8
        }
      }
    }
  }
});
