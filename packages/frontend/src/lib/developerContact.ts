export interface DeveloperContact {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
}

const DEFAULT_DEVELOPER_CONTACT: DeveloperContact = {
  name: "Mahmoud Khedr",
  email: "mahmoud.s.khedr.2@gmail.com",
  phone: "01016240934",
  linkedin: "https://www.linkedin.com/in/mahmoud-s-khedr/"
};

function readEnvValue(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function getDeveloperContact(): DeveloperContact {
  const name = readEnvValue(import.meta.env.VITE_FOOTER_NAME as string | undefined);
  const email = readEnvValue(import.meta.env.VITE_FOOTER_EMAIL as string | undefined);
  const phone = readEnvValue(import.meta.env.VITE_FOOTER_PHONE as string | undefined);
  const linkedin = readEnvValue(import.meta.env.VITE_FOOTER_LINKEDIN as string | undefined);

  return {
    name: name || DEFAULT_DEVELOPER_CONTACT.name,
    email: email || DEFAULT_DEVELOPER_CONTACT.email,
    phone: phone || DEFAULT_DEVELOPER_CONTACT.phone,
    linkedin: linkedin || DEFAULT_DEVELOPER_CONTACT.linkedin
  };
}
