import { ageParts } from '@latif/shared';
import { useTranslation } from 'react-i18next';

/** "3 years 5 months" / "3 سنوات و5 أشهر" */
export function useFormatAge() {
  const { t, i18n } = useTranslation();
  return (birthDate: string) => {
    const { years, months } = ageParts(new Date(`${birthDate}T00:00:00`));
    const y = years ? t('age.y', { count: years }) : '';
    const m = months ? t('age.m', { count: months }) : '';
    if (y && m) return i18n.language === 'ar' ? `${y}${t('age.and')}${m}` : `${y} ${m}`;
    return y || m || t('age.newborn');
  };
}
