from transformers import pipeline
from typing import Dict, List
import numpy as np

class AIService:
    def __init__(self):
        # Initialize the zero-shot classification pipeline
        self.classifier = pipeline(
            "zero-shot-classification",
            model="facebook/bart-large-mnli"
        )
        
        # Define common expense categories
        self.categories = [
            "Food & Dining",
            "Transportation",
            "Housing",
            "Utilities",
            "Healthcare",
            "Entertainment",
            "Shopping",
            "Education",
            "Personal Care",
            "Travel",
            "Insurance",
            "Investments",
            "Gifts & Donations",
            "Other"
        ]

    def categorize_transaction(self, description: str) -> Dict[str, float]:
        """
        Categorize a transaction description using zero-shot classification
        Returns a dictionary of category probabilities
        """
        result = self.classifier(
            description,
            candidate_labels=self.categories,
            multi_label=False
        )
        
        # Convert to dictionary with category probabilities
        category_probs = dict(zip(result["labels"], result["scores"]))
        return category_probs

    def get_most_likely_category(self, description: str) -> tuple[str, float]:
        """
        Get the most likely category for a transaction
        Returns a tuple of (category, confidence_score)
        """
        probs = self.categorize_transaction(description)
        best_category = max(probs.items(), key=lambda x: x[1])
        return best_category

    def analyze_spending_patterns(self, transactions: List[Dict]) -> Dict:
        """
        Analyze spending patterns from transaction history
        Returns insights about spending habits
        """
        # Group transactions by category
        category_totals = {}
        for transaction in transactions:
            category = transaction.get("category", "Other")
            amount = transaction.get("amount", 0)
            category_totals[category] = category_totals.get(category, 0) + amount

        # Calculate total spending
        total_spending = sum(category_totals.values())

        # Calculate category percentages
        category_percentages = {
            category: (amount / total_spending) * 100
            for category, amount in category_totals.items()
        }

        # Identify top spending categories
        top_categories = sorted(
            category_percentages.items(),
            key=lambda x: x[1],
            reverse=True
        )[:3]

        return {
            "total_spending": total_spending,
            "category_breakdown": category_percentages,
            "top_categories": top_categories
        } 