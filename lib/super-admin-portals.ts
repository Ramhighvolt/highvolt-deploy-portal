export type SuperAdminPortal = {
  id: string;
  label: string;
  url: string;
};

export const SUPER_ADMIN_PORTALS: SuperAdminPortal[] = [
  {
    id: "qa-edupass-product",
    label: "Quantum Agent & Quantum Edupass (Product)",
    url: "https://staging.highvolt.tech/super-admin/embed?accessToken=sa_pe_nuwyadpcd6SiS5DC2W1KY6t4Ctbr0PNE",
  },
  {
    id: "ledgerlink",
    label: "Ledgerlink",
    url: "https://staging.highvolt.tech/ledgerlink/platform/embed?accessToken=ll_pe_k3_47Kjqq5fe_w4vBaa19jyJCh3hPArn",
  },
];
