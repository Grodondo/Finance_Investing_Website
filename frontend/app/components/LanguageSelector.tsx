import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

interface Language {
  code: string;
  name: string;
  flag: string;
}

const languages: Language[] = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' }
];

export default function LanguageSelector() {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  
  // Get current language
  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];
  
  // Handle language change
  const changeLanguage = (code: string) => {
    i18n.changeLanguage(code);
    setIsOpen(false);
  };
  
  return (
    <div className="relative">
      <button
        type="button"
        className="flex items-center text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="mr-1">{currentLanguage.flag}</span>
        <span className="hidden md:block">{currentLanguage.name}</span>
        <ChevronDownIcon className="h-4 w-4 ml-1" />
      </button>
      
      {isOpen && (
        <div className="origin-top-right absolute right-0 mt-2 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1">
            {languages.map((language) => (
              <button
                key={language.code}
                className={`${
                  language.code === i18n.language
                    ? 'bg-gray-100 dark:bg-gray-700 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-700 dark:text-gray-300'
                } flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700`}
                onClick={() => changeLanguage(language.code)}
              >
                <span className="mr-2">{language.flag}</span>
                {language.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 