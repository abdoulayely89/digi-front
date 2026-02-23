// src/styles/theme.js
export const themeTokens = {
  token: {
    colorPrimary: '#F97316',   // corail chaleureux
    colorInfo: '#F97316',
    colorSuccess: '#22C55E',
    colorWarning: '#F59E0B',
    colorError: '#EF4444',

    colorBgBase: '#F7F8FB',
    colorBgContainer: '#FFFFFF',
    colorBgLayout: '#F7F8FB',
    colorText: '#0F172A',
    colorTextSecondary: '#475569',

    borderRadius: 12,
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'",
  },

  components: {
    Layout: {
      bodyBg: '#F7F8FB',
      headerBg: '#FFFFFF',
      siderBg: '#FFFFFF',
    },
    Menu: {
      itemBg: 'transparent',
      subMenuItemBg: 'transparent',
      itemColor: '#0F172A',
      itemHoverBg: 'rgba(249,115,22,0.10)',
      itemSelectedBg: 'rgba(249,115,22,0.16)',
      itemSelectedColor: '#0F172A',
    },
    Card: {
      colorBgContainer: '#FFFFFF',
    },
    Table: {
      headerBg: '#F8FAFC',
      rowHoverBg: '#F8FAFC',
    },
    Input: {
      colorBgContainer: '#FFFFFF',
    },
    Drawer: {
      colorBgElevated: '#FFFFFF',
    },
  },
}