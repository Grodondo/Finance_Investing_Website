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
} from "@heroicons/react/24/outline";

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

// Interface for credit card
interface CreditCard {
  id: string;
  cardNumber: string;
  cardholderName: string;
  expiryDate: string;
  cvv: string;
  type: string;
}

export default function Profile() {
  const { user, getAuthHeader, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for user details
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  // State for credit cards
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
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

  // Fetch user data including profile picture, 2FA status, and credit cards
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    const fetchUserData = async () => {
      try {
        setIsLoading(true);
        const authHeader = getAuthHeader();
        if (!authHeader) return;

        // Fetch profile data
        const profileResponse = await fetch("/api/user/profile", {
          headers: {
            ...authHeader,
            "Content-Type": "application/json",
          },
        });

        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          setName(profileData.name || "");
          setEmail(profileData.email || "");
          setProfilePicture(profileData.profile_picture || null);
          setIs2FAEnabled(profileData.is_2fa_enabled || false);
        }

        // Fetch credit cards
        const cardsResponse = await fetch("/api/user/credit-cards", {
          headers: {
            ...authHeader,
            "Content-Type": "application/json",
          },
        });

        if (cardsResponse.ok) {
          const cardsData = await cardsResponse.json();
          setCreditCards(cardsData);
        }
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
  }, [isAuthenticated, navigate, getAuthHeader]);

  // Handle profile picture upload
  const handleProfilePictureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onloadend = () => {
        setProfilePicture(reader.result as string);
      };
      
      reader.readAsDataURL(file);
      // Here you would upload the file to your backend
      uploadProfilePicture(file);
    }
  };

  // Upload profile picture to server
  const uploadProfilePicture = async (file: File) => {
    try {
      setIsLoading(true);
      const authHeader = getAuthHeader();
      if (!authHeader) return;

      const formData = new FormData();
      formData.append("profile_picture", file);

      const response = await fetch("/api/user/profile-picture", {
        method: "POST",
        headers: {
          ...authHeader,
        },
        body: formData,
      });

      if (response.ok) {
        setMessage({
          text: "Profile picture uploaded successfully!",
          type: "success",
        });
      } else {
        throw new Error("Failed to upload profile picture");
      }
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      setMessage({
        text: "Failed to upload profile picture. Please try again.",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Save user profile changes
  const saveProfileChanges = async () => {
    try {
      setIsLoading(true);
      const authHeader = getAuthHeader();
      if (!authHeader) return;

      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          ...authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
        }),
      });

      if (response.ok) {
        setIsEditingProfile(false);
        setMessage({
          text: "Profile updated successfully!",
          type: "success",
        });
      } else {
        throw new Error("Failed to update profile");
      }
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

  // Validate credit card
  const validateCardNumber = (number: string): boolean => {
    // Basic validation using Luhn algorithm
    number = number.replace(/\s+/g, "");
    
    // Check if the card matches any known patterns
    for (const type in CARD_TYPES) {
      if (CARD_TYPES[type as keyof typeof CARD_TYPES].pattern.test(number)) {
        setNewCard({ ...newCard, type });
        return true;
      }
    }
    
    return false;
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

    if (!newCard.cardNumber) {
      errors.cardNumber = "Card number is required";
      hasErrors = true;
    } else if (!validateCardNumber(newCard.cardNumber)) {
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
    } else {
      const [month, year] = newCard.expiryDate.split("/");
      const currentYear = new Date().getFullYear() % 100;
      const currentMonth = new Date().getMonth() + 1;
      
      if (
        parseInt(year, 10) < currentYear ||
        (parseInt(year, 10) === currentYear && parseInt(month, 10) < currentMonth)
      ) {
        errors.expiryDate = "Card is expired";
        hasErrors = true;
      }
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
      const authHeader = getAuthHeader();
      if (!authHeader) return;

      const response = await fetch("/api/user/credit-cards", {
        method: "POST",
        headers: {
          ...authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...newCard,
          cardNumber: newCard.cardNumber.replace(/\s+/g, ""),
        }),
      });

      if (response.ok) {
        const createdCard = await response.json();
        setCreditCards([...creditCards, createdCard]);
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
      } else {
        throw new Error("Failed to add credit card");
      }
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
      const authHeader = getAuthHeader();
      if (!authHeader) return;

      const response = await fetch(`/api/user/credit-cards/${cardId}`, {
        method: "DELETE",
        headers: {
          ...authHeader,
        },
      });

      if (response.ok) {
        setCreditCards(creditCards.filter(card => card.id !== cardId));
        setMessage({
          text: "Credit card removed successfully!",
          type: "success",
        });
      } else {
        throw new Error("Failed to delete credit card");
      }
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
      const authHeader = getAuthHeader();
      if (!authHeader) return;

      const response = await fetch("/api/user/2fa/setup", {
        method: "POST",
        headers: {
          ...authHeader,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Mock QR code for demo purposes (in a real app, this would come from the backend)
        setShowQRCode(true);
      } else {
        throw new Error("Failed to setup 2FA");
      }
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

  // Verify 2FA code
  const verify2FACode = async () => {
    try {
      setIsLoading(true);
      const authHeader = getAuthHeader();
      if (!authHeader) return;

      const response = await fetch("/api/user/2fa/verify", {
        method: "POST",
        headers: {
          ...authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: verificationCode,
        }),
      });

      if (response.ok) {
        setIs2FAEnabled(true);
        setShowQRCode(false);
        setVerificationCode("");
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
      const authHeader = getAuthHeader();
      if (!authHeader) return;

      const response = await fetch("/api/user/2fa/disable", {
        method: "POST",
        headers: {
          ...authHeader,
        },
      });

      if (response.ok) {
        setIs2FAEnabled(false);
        setMessage({
          text: "Two-factor authentication disabled successfully!",
          type: "success",
        });
      } else {
        throw new Error("Failed to disable 2FA");
      }
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
  const maskCardNumber = (number: string): string => {
    const last4 = number.slice(-4);
    return `•••• •••• •••• ${last4}`;
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
                  {profilePicture ? (
                    <img
                      src={profilePicture}
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
                  onClick={() => setIsEditingProfile(!isEditingProfile)}
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

              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                {isEditingProfile ? (
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="name"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        Name
                      </label>
                      <input
                        type="text"
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="email"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        Email
                      </label>
                      <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={saveProfileChanges}
                        className="mt-2 px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Name
                        </p>
                        <p className="mt-1 text-base font-medium text-gray-900 dark:text-white">
                          {name}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Email
                        </p>
                        <p className="mt-1 text-base font-medium text-gray-900 dark:text-white">
                          {email}
                        </p>
                      </div>
                    </div>
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
                        <img
                          src={`/assets/${CARD_TYPES[card.type as keyof typeof CARD_TYPES]?.icon || "generic-card.svg"}`}
                          alt={card.type}
                          className="h-6 w-auto"
                        />
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
                      onClick={() => handleDeleteCard(card.id)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                    >
                      <XCircleIcon className="h-5 w-5" />
                    </button>
                  </div>
                ))}

                {/* Add new card form */}
                {showAddCard && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
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
                          } dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500`}
                        />
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
                          } dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500`}
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
                              let value = e.target.value.replace(/\D/g, "");
                              if (value.length > 2) {
                                value = `${value.slice(0, 2)}/${value.slice(2, 4)}`;
                              }
                              setNewCard({
                                ...newCard,
                                expiryDate: value,
                              });
                            }}
                            placeholder="MM/YY"
                            maxLength={5}
                            className={`w-full rounded-md border ${
                              cardErrors.expiryDate
                                ? "border-red-300 dark:border-red-600"
                                : "border-gray-300 dark:border-gray-600"
                            } dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500`}
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
                            } dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500`}
                          />
                          {cardErrors.cvv && (
                            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                              {cardErrors.cvv}
                            </p>
                          )}
                        </div>
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
                      onClick={handleDisable2FA}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                    >
                      Disable
                    </button>
                  ) : (
                    <button
                      onClick={handleEnable2FA}
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
                      Scan this QR code with your authenticator app and enter the verification code below
                    </p>
                    <div className="flex justify-center mb-4">
                      {/* This would be a real QR code in production */}
                      <div className="h-48 w-48 bg-gray-200 dark:bg-gray-600 rounded-md flex items-center justify-center">
                        <span className="text-gray-500 dark:text-gray-400 text-sm">
                          QR Code Placeholder
                        </span>
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
    </div>
  );
} 