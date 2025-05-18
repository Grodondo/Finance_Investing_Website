import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  UserCircleIcon,
  CreditCardIcon,
  ShieldCheckIcon,
  PencilIcon,
  XCircleIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  CameraIcon,
  PlusIcon,
  KeyIcon,
  LockClosedIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";

// QR Code library
import { QRCodeSVG } from 'qrcode.react';

// Import the 2FA components
import TwoFactorSetup from '../components/TwoFactorSetup';
import TwoFactorDisable from '../components/TwoFactorDisable';

// Credit card types with their validation patterns
const CARD_TYPES = {
  visa: {
    name: "Visa",
    pattern: /^4[0-9]{12}(?:[0-9]{3})?$/,
    icon: "visa-icon.svg", // We would add these icons to public directory
  },
  mastercard: {
    name: "Mastercard",
    pattern: /^5[1-5][0-9]{14}$/,
    icon: "mastercard-icon.svg",
  },
  amex: {
    name: "American Express",
    pattern: /^3[47][0-9]{13}$/,
    icon: "amex-icon.svg",
  },
  discover: {
    name: "Discover",
    pattern: /^6(?:011|5[0-9]{2})[0-9]{12}$/,
    icon: "discover-icon.svg",
  },
};

// Mock data for development - empty by default
const MOCK_CREDIT_CARDS: CreditCard[] = [];

// Interface for credit card
interface CreditCard {
  id: string;
  cardNumber: string;
  cardholderName: string;
  expiryDate: string;
  cvv: string;
  type: string;
}

// Card brand icons in SVG format
const CARD_ICONS = {
  visa: (
    <svg className="h-6 w-auto" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.3 13.1L13.6 18.6H11.6L9.4 14.9L8.2 18.6H6.3L8.3 12.8H10.2L10.3 13.1Z" fill="#2566AF"/>
      <path d="M14.1 18.6L12.4 12.8H14.2L15.9 18.6H14.1Z" fill="#2566AF"/>
      <path d="M18.7 12.9C18.1 12.9 17.5 13.1 17.1 13.3L16.9 14.8C17.3 14.5 17.8 14.3 18.3 14.3C19 14.3 19.4 14.6 19.4 15.1C19.4 16 18.2 16 17.9 16.5C17.6 17 17.9 17.6 18.4 18.2C18.9 18.7 19.7 18.8 20.5 18.6C20.9 18.5 21.2 18.4 21.5 18.2L21.7 16.7C21.3 17 20.8 17.2 20.3 17.2C19.7 17.2 19.2 16.9 19.2 16.4C19.2 15.5 20.4 15.5 20.7 15C21 14.5 20.7 13.9 20.3 13.4C19.8 13 19.2 12.8 18.7 12.9Z" fill="#2566AF"/>
      <path d="M22.7 13.1L22.5 14.6H24.1L23.9 16.1H22.3L22.1 17.6H23.9L23.8 18.6H20.2L21.2 12.8H24.8L24.6 14.2L22.7 13.1Z" fill="#2566AF"/>
      <path d="M27.3 11H19.5L18.5 19H26.3L27.3 11Z" fill="#EB001B" fillOpacity="0.1"/>
      <path d="M27.3 11H23.4L18.5 19H22.4L27.3 11Z" fill="#0099DF" fillOpacity="0.1"/>
    </svg>
  ),
  mastercard: (
    <svg className="h-6 w-auto" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15.3 11.2H16.7V20.8H15.3V11.2Z" fill="#FF5F00"/>
      <path d="M15.6 11.2C14.3 12.3 13.5 13.9 13.5 15.7C13.5 17.5 14.3 19.1 15.6 20.2C16.9 19.1 17.7 17.5 17.7 15.7C17.7 13.9 16.9 12.3 15.6 11.2Z" fill="#EB001B"/>
      <path d="M21.9 15.7C21.9 17.6 21 19.3 19.6 20.4C20.9 21.5 22.6 22.1 24.5 22.1C26.4 22.1 28.1 21.5 29.4 20.4C30.7 19.3 31.5 17.7 31.5 15.9C31.5 14.1 30.7 12.5 29.4 11.4C28.1 10.3 26.4 9.7 24.5 9.7C22.6 9.7 20.9 10.3 19.6 11.4C21 12.5 21.9 14 21.9 15.7Z" fill="#F79E1B"/>
    </svg>
  ),
  amex: (
    <svg className="h-6 w-auto" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M27 10H5C4.4 10 4 10.4 4 11V21C4 21.6 4.4 22 5 22H27C27.6 22 28 21.6 28 21V11C28 10.4 27.6 10 27 10Z" fill="#006FCF" fillOpacity="0.1"/>
      <path d="M15.9 17.5H13.5L12.5 15.2L11.6 17.5H9.1L11.2 13.8L9.1 10.1H11.5L12.4 12.3L13.3 10.1H15.8L13.7 13.8L15.9 17.5Z" fill="#006FCF"/>
      <path d="M16.6 17.5V10.1H20.9V12H18.6V13H20.7V14.8H18.6V15.7H20.9V17.5H16.6Z" fill="#006FCF"/>
      <path d="M22.5 10.1H24.6L26.2 13.3V10.1H28.9L29.8 14.2L30.6 10.1H33.2V17.5H31.2V12.7L30.2 17.5H28.6L27.5 12.7V17.5H24.4L24 16.4H21.7L21.3 17.5H19.2L21.3 10.1H22.5ZM23.4 14.8L22.9 13.3L22.4 14.8H23.4Z" fill="#006FCF"/>
    </svg>
  ),
  discover: (
    <svg className="h-6 w-auto" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M27 22H5C4.4 22 4 21.6 4 21V11C4 10.4 4.4 10 5 10H27C27.6 10 28 10.4 28 11V21C28 21.6 27.6 22 27 22Z" fill="#4D4D4D" fillOpacity="0.1"/>
      <path d="M16.3 16C16.3 18.2 18.1 20 20.3 20C22.5 20 24.3 18.2 24.3 16C24.3 13.8 22.5 12 20.3 12C18.1 12 16.3 13.8 16.3 16Z" fill="#FF6F00"/>
      <path d="M7.8 13.6H9.2V18.5H7.8V13.6Z" fill="#4D4D4D"/>
      <path d="M11.3 13.6L13.2 16.9V13.6H14.5V18.5H13.2L11.3 15.2V18.5H10V13.6H11.3Z" fill="#4D4D4D"/>
      <path d="M15.3 17.4C15.8 18 16.5 18.3 17.3 18.3C17.7 18.3 18.2 18.2 18.6 18C19 17.8 19.3 17.5 19.6 17.1L18.7 16.5C18.5 16.7 18.3 16.9 18.1 17C17.9 17.1 17.6 17.1 17.3 17.1C16.9 17.1 16.5 17 16.2 16.7C15.9 16.4 15.7 16 15.7 15.5C15.7 15.1 15.9 14.7 16.2 14.4C16.5 14.1 16.9 13.9 17.3 13.9C17.6 13.9 17.9 14 18.1 14.1C18.3 14.2 18.5 14.3 18.7 14.6L19.6 14C19.3 13.6 19 13.3 18.6 13.1C18.2 12.9 17.7 12.8 17.3 12.8C16.5 12.8 15.8 13.1 15.3 13.7C14.8 14.3 14.5 14.9 14.5 15.6C14.5 16.2 14.8 16.9 15.3 17.4Z" fill="#4D4D4D"/>
    </svg>
  ),
  generic: (
    <svg className="h-6 w-auto" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="8" width="24" height="16" rx="2" fill="#E5E7EB"/>
      <path d="M8 13H12V15H8V13Z" fill="#9CA3AF"/>
      <path d="M8 17H16V19H8V17Z" fill="#9CA3AF"/>
    </svg>
  )
};

// Secure card storage helper functions
const secureCardStorage = {
  // In a real application, these functions would use proper encryption
  // and communicate with a backend API to store data securely
  
  // This encrypts the card number, keeping only the last 4 digits in plain text
  // In production: Use a proper encryption library on the backend
  encryptCard: (card: CreditCard): Partial<CreditCard> => {
    // In a real app, this would use proper encryption
    // Here we're just simulating by masking the card number
    const last4 = card.cardNumber.slice(-4);
    return {
      id: card.id,
      cardholderName: card.cardholderName,
      // Store only masked data in localStorage (just for simulation)
      cardNumber: `xxxxxxxxxxxx${last4}`,
      expiryDate: card.expiryDate,
      type: card.type
      // Note: CVV is never stored, even in encrypted form
    };
  },
  
  // Load cards from localStorage (in a real app, this would fetch from API)
  loadCards: (): Partial<CreditCard>[] => {
    try {
      const storedCards = localStorage.getItem('userCreditCards');
      return storedCards ? JSON.parse(storedCards) : [];
    } catch (error) {
      console.error('Error loading cards from storage:', error);
      return [];
    }
  },
  
  // Save cards to localStorage (in a real app, this would send to API)
  saveCards: (cards: Partial<CreditCard>[]) => {
    try {
      localStorage.setItem('userCreditCards', JSON.stringify(cards));
    } catch (error) {
      console.error('Error saving cards to storage:', error);
    }
  },
  
  // Add a new card
  addCard: (card: CreditCard) => {
    const cards = secureCardStorage.loadCards();
    const secureCard = secureCardStorage.encryptCard(card);
    cards.push(secureCard);
    secureCardStorage.saveCards(cards);
  },
  
  // Remove a card by ID
  removeCard: (cardId: string) => {
    const cards = secureCardStorage.loadCards();
    const filteredCards = cards.filter(card => card.id !== cardId);
    secureCardStorage.saveCards(filteredCards);
  }
};

// User profile storage helper
const userProfileStorage = {
  // Save profile picture to localStorage (in a real app, this would upload to server/CDN)
  saveProfilePicture: (imageData: string) => {
    localStorage.setItem('userProfilePicture', imageData);
  },
  
  // Get profile picture from localStorage
  getProfilePicture: (): string | null => {
    return localStorage.getItem('userProfilePicture');
  },
  
  // Save user profile data
  saveProfileData: (username: string | undefined, email: string | undefined, secondaryEmail: string | undefined, is2FAEnabled: boolean) => {
    const userData = { 
      username: username || 'User', 
      email: email || 'user@example.com',
      secondaryEmail: secondaryEmail || '',
      is2FAEnabled 
    };
    localStorage.setItem('userData', JSON.stringify(userData));
  },
  
  // Get user profile data
  getProfileData: () => {
    try {
      const userData = localStorage.getItem('userData');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error loading user data from storage:', error);
      return null;
    }
  }
};

export default function Profile() {
  const { user, getAuthHeader, isAuthenticated, logout, updateUserProfile } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for user details
  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [profile_picture, setProfile_picture] = useState<string | undefined>(user?.profile_picture || undefined);
  const [is2FAEnabled, setIs2FAEnabled] = useState(user?.is2FAEnabled || false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [passwordErrors, setPasswordErrors] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  // State for credit cards
  const [creditCards, setCreditCards] = useState<Partial<CreditCard>[]>([]);
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCard, setNewCard] = useState<CreditCard>({
    id: "",
    cardNumber: "",
    cardholderName: "",
    expiryDate: "",
    cvv: "",
    type: "",
  });
  const [cardErrors, setCardErrors] = useState({
    cardNumber: "",
    cardholderName: "",
    expiryDate: "",
    cvv: "",
  });

  // Add qrCodeValue state
  const [qrCodeValue, setQrCodeValue] = useState("");

  // Add 2FA state
  const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false);
  const [showTwoFactorDisable, setShowTwoFactorDisable] = useState(false);

  // Fetch user data including profile picture, 2FA status, and credit cards
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    const fetchUserData = async () => {
      try {
        setIsLoading(true);
        
        // Load data from localStorage (simulating database persistence)
        const storedProfilePic = userProfileStorage.getProfilePicture();
        const storedUserData = userProfileStorage.getProfileData();
        const storedCards = secureCardStorage.loadCards();
        
        // If we have stored user data, use it
        if (storedUserData) {
          setUsername(storedUserData.username || user?.username || "User");
          setEmail(storedUserData.email || user?.email || "user@example.com");
          setSecondaryEmail(storedUserData.secondaryEmail || "");
          setIs2FAEnabled(storedUserData.is2FAEnabled || false);
        } else {
          // Otherwise use data from AuthContext
          setUsername(user?.username || "User");
          setEmail(user?.email || "user@example.com");
          setSecondaryEmail("");
          setIs2FAEnabled(user?.is2FAEnabled || false);
        }
        
        // Set profile picture from localStorage or AuthContext
        setProfile_picture(storedProfilePic || user?.profile_picture || undefined);
        
        // Set credit cards from localStorage
        setCreditCards(storedCards);
      } catch (error) {
        console.error("Error fetching user data:", error);
        setMessage({
          text: "Failed to load profile data. Please try again.",
          type: "error",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [isAuthenticated, navigate, user]);

  // Handle profile picture upload
  const handleProfilePictureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onloadend = () => {
        const result = reader.result as string;
        setProfile_picture(result || undefined);
        
        // Store in localStorage to persist between sessions
        userProfileStorage.saveProfilePicture(result);
        
        // Update user context with new profile picture
        if (updateUserProfile) {
          updateUserProfile({ profile_picture: result || undefined });
        }
        
        setMessage({
          text: "Profile picture uploaded successfully!",
          type: "success",
        });
      };
      
      reader.readAsDataURL(file);
      // In a real app, we would upload to server/CDN here
    }
  };

  // Mock function for profile picture upload
  const uploadProfilePicture = async (file: File) => {
    // Mock implementation - in a real app this would call the API
    return true;
  };

  // Save user profile changes
  const saveProfileChanges = async () => {
    try {
      setIsLoading(true);
      
      // Mock API call - in a real app this would update the backend
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Save to localStorage to persist between sessions
      userProfileStorage.saveProfileData(username, email, secondaryEmail, is2FAEnabled);
      
      // Update user in context
      if (updateUserProfile) {
        updateUserProfile({ 
          username: username, 
          email: email,
          profile_picture: profile_picture 
        });
      }
      
      setIsEditingProfile(false);
      setMessage({
        text: "Profile updated successfully!",
        type: "success",
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage({
        text: "Failed to update profile. Please try again.",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle password change
  const handlePasswordChange = async () => {
    // Reset errors
    setPasswordErrors({
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    });

    // Validate passwords
    let hasErrors = false;
    const errors = {
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    };

    if (!currentPassword) {
      errors.currentPassword = "Current password is required";
      hasErrors = true;
    }

    if (!newPassword) {
      errors.newPassword = "New password is required";
      hasErrors = true;
    } else if (newPassword.length < 8) {
      errors.newPassword = "Password must be at least 8 characters";
      hasErrors = true;
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Please confirm your new password";
      hasErrors = true;
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
      hasErrors = true;
    }

    if (hasErrors) {
      setPasswordErrors(errors);
      return;
    }

    try {
      setIsLoading(true);
      
      // Mock API call - in a real app this would update the backend
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Reset password fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsChangingPassword(false);
      
      setMessage({
        text: "Password updated successfully!",
        type: "success",
      });
    } catch (error) {
      console.error("Error updating password:", error);
      setMessage({
        text: "Failed to update password. Please check your current password.",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Validate credit card
  const validateCardNumber = (number: string): boolean => {
    // Basic validation using Luhn algorithm
    const digits = number.replace(/\s+/g, "").split('')
      .map(x => parseInt(x, 10));
    
    for (let i = digits.length - 2; i >= 0; i -= 2) {
      let val = digits[i] * 2;
      if (val > 9) val -= 9;
      digits[i] = val;
    }
    
    const sum = digits.reduce((acc, val) => acc + val, 0);
    
    // Check if the card matches any known patterns
    for (const type in CARD_TYPES) {
      if (CARD_TYPES[type as keyof typeof CARD_TYPES].pattern.test(number)) {
        setNewCard({ ...newCard, type });
        return sum % 10 === 0; // Valid Luhn algorithm check
      }
    }
    
    return false;
  };

  // Format expiry date properly
  const formatExpiryDate = (value: string) => {
    value = value.replace(/\D/g, "");
    if (value.length > 0) {
      // Insert / after MM if length is 2 or more
      if (value.length >= 2) {
        const month = parseInt(value.substring(0, 2), 10);
        // Ensure month is between 1-12
        if (month < 1) {
          value = '01' + value.substring(2);
        } else if (month > 12) {
          value = '12' + value.substring(2);
        }
        value = value.substring(0, 2) + '/' + value.substring(2);
      }
      // Limit to MM/YY format (5 chars total)
      value = value.substring(0, 5);
    }
    return value;
  };

  // Validate card expiry date
  const validateExpiryDate = (expiryDate: string): boolean => {
    if (!expiryDate || expiryDate.length !== 5) return false;
    
    const [monthStr, yearStr] = expiryDate.split('/');
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10) + 2000; // Convert YY to 20YY
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // JS months are 0-indexed
    
    // Check if date is valid (MM between 1-12)
    if (month < 1 || month > 12) return false;
    
    // Check if expiry date is in the future
    if (year < currentYear) return false;
    if (year === currentYear && month < currentMonth) return false;
    
    return true;
  };

  // Handle adding new credit card
  const handleAddCard = async () => {
    // Validate card details
    let hasErrors = false;
    const errors = {
      cardNumber: "",
      cardholderName: "",
      expiryDate: "",
      cvv: "",
    };

    // Clean card number (remove spaces)
    const cleanCardNumber = newCard.cardNumber.replace(/\s+/g, "");

    if (!cleanCardNumber) {
      errors.cardNumber = "Card number is required";
      hasErrors = true;
    } else if (!validateCardNumber(cleanCardNumber)) {
      errors.cardNumber = "Invalid card number";
      hasErrors = true;
    }

    if (!newCard.cardholderName) {
      errors.cardholderName = "Cardholder name is required";
      hasErrors = true;
    }

    if (!newCard.expiryDate) {
      errors.expiryDate = "Expiry date is required";
      hasErrors = true;
    } else if (!validateExpiryDate(newCard.expiryDate)) {
      errors.expiryDate = "Invalid or expired date";
      hasErrors = true;
    }

    if (!newCard.cvv) {
      errors.cvv = "CVV is required";
      hasErrors = true;
    } else if (!/^\d{3,4}$/.test(newCard.cvv)) {
      errors.cvv = "Invalid CVV";
      hasErrors = true;
    }

    if (hasErrors) {
      setCardErrors(errors);
      return;
    }

    try {
      setIsLoading(true);
      
      // Mock API call to add card
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Generate random ID for new card
      const createdCard = {
        ...newCard,
        id: `card-${Date.now()}`,
        cardNumber: cleanCardNumber
      };
      
      // Store card securely (in localStorage for demo purposes)
      secureCardStorage.addCard(createdCard);
      
      // Add to local state (but only the secure version without CVV)
      const secureCard = secureCardStorage.encryptCard(createdCard);
      setCreditCards([...creditCards, secureCard]);
      
      setShowAddCard(false);
      setNewCard({
        id: "",
        cardNumber: "",
        cardholderName: "",
        expiryDate: "",
        cvv: "",
        type: "",
      });
      setMessage({
        text: "Credit card added successfully!",
        type: "success",
      });
    } catch (error) {
      console.error("Error adding credit card:", error);
      setMessage({
        text: "Failed to add credit card. Please try again.",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle deleting a credit card
  const handleDeleteCard = async (cardId: string) => {
    try {
      setIsLoading(true);
      
      // Mock API call to delete card
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Remove from localStorage
      secureCardStorage.removeCard(cardId);
      
      // Update local state
      setCreditCards(creditCards.filter(card => card.id !== cardId));
      
      setMessage({
        text: "Credit card removed successfully!",
        type: "success",
      });
    } catch (error) {
      console.error("Error deleting credit card:", error);
      setMessage({
        text: "Failed to delete credit card. Please try again.",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle enabling 2FA
  const handleEnable2FA = async () => {
    try {
      setIsLoading(true);
      
      // Mock API call to setup 2FA
      // In a real app, the server would generate a secret and return it
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Generate a mock 2FA secret (in a real app, this would come from the server)
      const mockSecret = generateMockSecret();
      setQrCodeValue(`otpauth://totp/PersonalFinanceManager:${email}?secret=${mockSecret}&issuer=PersonalFinanceManager`);
      
      setShowQRCode(true);
    } catch (error) {
      console.error("Error setting up 2FA:", error);
      setMessage({
        text: "Failed to set up 2FA. Please try again.",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Generate a mock 2FA secret (in a real app, this would be done on the server)
  const generateMockSecret = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Verify 2FA code
  const verify2FACode = async () => {
    try {
      setIsLoading(true);
      
      // Mock API call to verify 2FA code
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Simple validation - in a real app the server would verify this
      if (verificationCode.length === 6 && /^\d+$/.test(verificationCode)) {
        setIs2FAEnabled(true);
        setShowQRCode(false);
        setVerificationCode("");
        
        // Save to localStorage
        const userData = userProfileStorage.getProfileData() || { username: "", email: "" };
        userProfileStorage.saveProfileData(
          username, 
          email, 
          secondaryEmail, 
          true
        );
        
        // Update user context
        if (updateUserProfile) {
          updateUserProfile({ is2FAEnabled: true });
        }
        
        setMessage({
          text: "Two-factor authentication enabled successfully!",
          type: "success",
        });
      } else {
        throw new Error("Invalid verification code");
      }
    } catch (error) {
      console.error("Error verifying 2FA code:", error);
      setMessage({
        text: "Invalid verification code. Please try again.",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Disable 2FA
  const handleDisable2FA = async () => {
    try {
      setIsLoading(true);
      
      // Mock API call to disable 2FA
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setIs2FAEnabled(false);
      
      // Save to localStorage
      const userData = userProfileStorage.getProfileData() || { username: "", email: "", secondaryEmail: "" };
      userProfileStorage.saveProfileData(
        username, 
        email, 
        secondaryEmail, 
        false
      );
      
      // Update user context
      if (updateUserProfile) {
        updateUserProfile({ is2FAEnabled: false });
      }
      
      setMessage({
        text: "Two-factor authentication disabled successfully!",
        type: "success",
      });
    } catch (error) {
      console.error("Error disabling 2FA:", error);
      setMessage({
        text: "Failed to disable 2FA. Please try again.",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Format credit card number with spaces for display
  const formatCardNumber = (number: string): string => {
    return number.replace(/\s/g, "").replace(/(.{4})/g, "$1 ").trim();
  };

  // Mask credit card number except for last 4 digits
  const maskCardNumber = (number: string | undefined): string => {
    if (!number) return "•••• •••• •••• ••••";
    const last4 = number.slice(-4);
    return `•••• •••• •••• ${last4}`;
  };

  // Add handler for 2FA setup completion
  const handleTwoFactorSetupComplete = () => {
    setShowTwoFactorSetup(false);
    // Update user profile to reflect 2FA is enabled
    if (user) {
      updateUserProfile({ ...user, is2FAEnabled: true });
    }
  };

  // Add handler for 2FA disable completion
  const handleTwoFactorDisableComplete = () => {
    setShowTwoFactorDisable(false);
    // Update user profile to reflect 2FA is disabled
    if (user) {
      updateUserProfile({ ...user, is2FAEnabled: false });
    }
  };

  if (isLoading && !user) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
          {/* Header with profile picture */}
          <div className="relative h-40 bg-gradient-to-r from-indigo-500 to-purple-500">
            <div className="absolute -bottom-14 left-8">
              <div className="relative">
                <div className="h-28 w-28 rounded-full bg-white dark:bg-gray-700 p-1 shadow-lg">
                  {profile_picture ? (
                    <img
                      src={profile_picture}
                      alt="Profile"
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <UserCircleIcon className="h-full w-full text-gray-300 dark:text-gray-500" />
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 bg-indigo-600 dark:bg-indigo-500 p-2 rounded-full shadow-md hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors"
                >
                  <CameraIcon className="h-4 w-4 text-white" />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleProfilePictureUpload}
                  className="hidden"
                  accept="image/*"
                />
              </div>
            </div>
          </div>

          {/* Profile content */}
          <div className="pt-16 px-8 pb-8">
            {/* Message display */}
            {message.text && (
              <div
                className={`mb-4 p-4 rounded-md ${
                  message.type === "success"
                    ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-200"
                    : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200"
                }`}
              >
                <div className="flex items-center">
                  {message.type === "success" ? (
                    <CheckCircleIcon className="h-5 w-5 mr-2" />
                  ) : (
                    <ExclamationCircleIcon className="h-5 w-5 mr-2" />
                  )}
                  <span>{message.text}</span>
                </div>
              </div>
            )}

            {/* Profile details */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Profile Information
                </h2>
                <button
                  onClick={() => {
                    setIsEditingProfile(!isEditingProfile);
                    setIsChangingPassword(false);
                  }}
                  className="flex items-center text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
                >
                  {isEditingProfile ? "Cancel" : "Edit"}
                  {isEditingProfile ? (
                    <XCircleIcon className="ml-1 h-4 w-4" />
                  ) : (
                    <PencilIcon className="ml-1 h-4 w-4" />
                  )}
                </button>
              </div>

              <div className="bg-white dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600 shadow-sm">
                {isEditingProfile ? (
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="username"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        Username
                      </label>
                      <input
                        type="text"
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="email"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        Primary Email (cannot be changed)
                      </label>
                      <input
                        type="email"
                        id="email"
                        value={email}
                        disabled
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white shadow-sm cursor-not-allowed"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Contact support if you need to change your primary email.
                      </p>
                    </div>
                    <div>
                      <label
                        htmlFor="secondaryEmail"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        Secondary Email (for account recovery)
                      </label>
                      <input
                        type="email"
                        id="secondaryEmail"
                        value={secondaryEmail}
                        onChange={(e) => setSecondaryEmail(e.target.value)}
                        placeholder="backup@example.com"
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Add a backup email address to recover your account if needed.
                      </p>
                    </div>
                    <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-600">
                      <button
                        type="button"
                        onClick={() => {
                          setIsChangingPassword(!isChangingPassword);
                        }}
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm font-medium"
                      >
                        Change Password
                      </button>
                      <button
                        onClick={saveProfileChanges}
                        className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors"
                      >
                        Save Changes
                      </button>
                    </div>
                    
                    {isChangingPassword && (
                      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-600 rounded-md space-y-4">
                        <h3 className="text-md font-medium text-gray-900 dark:text-white mb-2">
                          Change Password
                        </h3>
                        <div>
                          <label
                            htmlFor="currentPassword"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                          >
                            Current Password
                          </label>
                          <input
                            type="password"
                            id="currentPassword"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className={`w-full rounded-md border ${
                              passwordErrors.currentPassword
                                ? "border-red-300 dark:border-red-600"
                                : "border-gray-300 dark:border-gray-600"
                            } bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500`}
                          />
                          {passwordErrors.currentPassword && (
                            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                              {passwordErrors.currentPassword}
                            </p>
                          )}
                        </div>
                        <div>
                          <label
                            htmlFor="newPassword"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                          >
                            New Password
                          </label>
                          <input
                            type="password"
                            id="newPassword"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className={`w-full rounded-md border ${
                              passwordErrors.newPassword
                                ? "border-red-300 dark:border-red-600"
                                : "border-gray-300 dark:border-gray-600"
                            } bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500`}
                          />
                          {passwordErrors.newPassword && (
                            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                              {passwordErrors.newPassword}
                            </p>
                          )}
                        </div>
                        <div>
                          <label
                            htmlFor="confirmPassword"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                          >
                            Confirm New Password
                          </label>
                          <input
                            type="password"
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className={`w-full rounded-md border ${
                              passwordErrors.confirmPassword
                                ? "border-red-300 dark:border-red-600"
                                : "border-gray-300 dark:border-gray-600"
                            } bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500`}
                          />
                          {passwordErrors.confirmPassword && (
                            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                              {passwordErrors.confirmPassword}
                            </p>
                          )}
                        </div>
                        <div className="flex justify-end">
                          <button
                            onClick={handlePasswordChange}
                            className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors"
                          >
                            Update Password
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Username
                        </p>
                        <p className="mt-1 text-base font-medium text-gray-900 dark:text-white">
                          {username}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Primary Email
                        </p>
                        <p className="mt-1 text-base font-medium text-gray-900 dark:text-white">
                          {email}
                        </p>
                      </div>
                    </div>
                    {secondaryEmail && (
                      <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Secondary Email
                        </p>
                        <p className="mt-1 text-base font-medium text-gray-900 dark:text-white">
                          {secondaryEmail}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Credit cards section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Payment Methods
                </h2>
                <button
                  onClick={() => setShowAddCard(!showAddCard)}
                  className="flex items-center text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
                >
                  {showAddCard ? "Cancel" : "Add Card"}
                  {showAddCard ? (
                    <XCircleIcon className="ml-1 h-4 w-4" />
                  ) : (
                    <PlusIcon className="ml-1 h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Credit cards list */}
              <div className="space-y-4">
                {creditCards.length === 0 && !showAddCard && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 text-center">
                    <CreditCardIcon className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500" />
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      No payment methods added yet
                    </p>
                    <button
                      onClick={() => setShowAddCard(true)}
                      className="mt-4 px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors"
                    >
                      Add Card
                    </button>
                  </div>
                )}

                {creditCards.map((card) => (
                  <div
                    key={card.id}
                    className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 flex justify-between items-center"
                  >
                    <div className="flex items-center">
                      <div className="h-10 w-10 bg-white dark:bg-gray-800 rounded-md flex items-center justify-center mr-4">
                        {CARD_ICONS[card.type as keyof typeof CARD_ICONS] || CARD_ICONS.generic}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {CARD_TYPES[card.type as keyof typeof CARD_TYPES]?.name || "Credit Card"}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {maskCardNumber(card.cardNumber)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => card.id ? handleDeleteCard(card.id) : null}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                    >
                      <XCircleIcon className="h-5 w-5" />
                    </button>
                  </div>
                ))}

                {/* Add new card form */}
                {showAddCard && (
                  <div className="bg-white dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600 shadow-sm">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Add Payment Method
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="cardNumber"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >
                          Card Number
                        </label>
                        <div className="flex items-center relative">
                          <input
                            type="text"
                            id="cardNumber"
                            value={newCard.cardNumber}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, "");
                              setNewCard({
                                ...newCard,
                                cardNumber: formatCardNumber(value),
                              });
                            }}
                            placeholder="1234 5678 9012 3456"
                            maxLength={19}
                            className={`w-full rounded-md border ${
                              cardErrors.cardNumber
                                ? "border-red-300 dark:border-red-600"
                                : "border-gray-300 dark:border-gray-600"
                            } bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 pl-10`}
                          />
                          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                            {newCard.type && CARD_ICONS[newCard.type as keyof typeof CARD_ICONS] 
                              ? CARD_ICONS[newCard.type as keyof typeof CARD_ICONS] 
                              : <CreditCardIcon className="h-5 w-5 text-gray-400" />}
                          </div>
                        </div>
                        {cardErrors.cardNumber && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                            {cardErrors.cardNumber}
                          </p>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor="cardholderName"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >
                          Cardholder Name
                        </label>
                        <input
                          type="text"
                          id="cardholderName"
                          value={newCard.cardholderName}
                          onChange={(e) =>
                            setNewCard({
                              ...newCard,
                              cardholderName: e.target.value,
                            })
                          }
                          placeholder="John Doe"
                          className={`w-full rounded-md border ${
                            cardErrors.cardholderName
                              ? "border-red-300 dark:border-red-600"
                              : "border-gray-300 dark:border-gray-600"
                          } bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500`}
                        />
                        {cardErrors.cardholderName && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                            {cardErrors.cardholderName}
                          </p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label
                            htmlFor="expiryDate"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                          >
                            Expiry Date (MM/YY)
                          </label>
                          <input
                            type="text"
                            id="expiryDate"
                            value={newCard.expiryDate}
                            onChange={(e) => {
                              const formattedExpiryDate = formatExpiryDate(e.target.value);
                              setNewCard({
                                ...newCard,
                                expiryDate: formattedExpiryDate,
                              });
                            }}
                            placeholder="MM/YY"
                            maxLength={5}
                            className={`w-full rounded-md border ${
                              cardErrors.expiryDate
                                ? "border-red-300 dark:border-red-600"
                                : "border-gray-300 dark:border-gray-600"
                            } bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500`}
                          />
                          {cardErrors.expiryDate && (
                            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                              {cardErrors.expiryDate}
                            </p>
                          )}
                        </div>
                        <div>
                          <label
                            htmlFor="cvv"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                          >
                            CVV
                          </label>
                          <input
                            type="text"
                            id="cvv"
                            value={newCard.cvv}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, "");
                              setNewCard({
                                ...newCard,
                                cvv: value,
                              });
                            }}
                            placeholder="123"
                            maxLength={4}
                            className={`w-full rounded-md border ${
                              cardErrors.cvv
                                ? "border-red-300 dark:border-red-600"
                                : "border-gray-300 dark:border-gray-600"
                            } bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500`}
                          />
                          {cardErrors.cvv && (
                            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                              {cardErrors.cvv}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Your card information is securely stored and encrypted.
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={handleAddCard}
                          className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors"
                        >
                          Add Card
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Two-factor authentication */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Two-Factor Authentication
              </h2>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <ShieldCheckIcon className="h-8 w-8 text-gray-400 dark:text-gray-500 mr-4" />
                    <div>
                      <p className="text-base font-medium text-gray-900 dark:text-white">
                        Two-Factor Authentication
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {is2FAEnabled
                          ? "Your account is protected with two-factor authentication"
                          : "Add an extra layer of security to your account"}
                      </p>
                    </div>
                  </div>
                  {is2FAEnabled ? (
                    <button
                      onClick={() => setShowTwoFactorDisable(true)}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                    >
                      Disable
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowTwoFactorSetup(true)}
                      className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors"
                    >
                      Enable
                    </button>
                  )}
                </div>

                {/* QR code for 2FA setup */}
                {showQRCode && (
                  <div className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-lg">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Set up Two-Factor Authentication
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      1. Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                      <br />
                      2. Enter the verification code shown in your app below
                    </p>
                    <div className="flex justify-center mb-4">
                      {/* Real QR code instead of placeholder */}
                      <div className="p-3 bg-white rounded-md">
                        <QRCodeSVG 
                          value={qrCodeValue} 
                          size={200}
                          level="H"
                          includeMargin={true}
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="verification-code"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >
                          Verification Code
                        </label>
                        <input
                          type="text"
                          id="verification-code"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                          placeholder="Enter 6-digit code"
                          maxLength={6}
                          className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={verify2FACode}
                          className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors"
                        >
                          Verify
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add 2FA components */}
      {showTwoFactorSetup && (
        <div className="mt-6">
          <TwoFactorSetup onSetupComplete={handleTwoFactorSetupComplete} />
        </div>
      )}
      
      {showTwoFactorDisable && (
        <div className="mt-6">
          <TwoFactorDisable onDisableComplete={handleTwoFactorDisableComplete} />
        </div>
      )}
    </div>
  );
} 