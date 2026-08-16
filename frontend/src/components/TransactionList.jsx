import React, { useState, memo, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Edit3,
  Trash2,
  Calendar,
  Tag,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useCurrency } from "../context/CurrencyContext";
import { formatCurrency } from "../utils/currency";

// =============================
// TransactionRow Component
// =============================
const TransactionRow = memo(({ transaction, onEdit, onDelete }) => {
  const [isActive, setIsActive] = useState(false);
  const { currency } = useCurrency();

  // Safety check for async/paginated data
  if (!transaction) {
    return (
      <div className="mx-4 my-2 bg-gray-100 dark:bg-gray-800 rounded-xl p-4 animate-pulse">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });



  return (
    <motion.div
      onHoverStart={() => setIsActive(true)}
      onHoverEnd={() => setIsActive(false)}
      onTap={() => setIsActive(!isActive)}
      className="mx-4 my-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 cursor-pointer"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full">
        {/* Left side (icon + details) */}
        <div className="flex items-start sm:items-center space-x-4 flex-1 min-w-0 w-full">
          <div
            className={`p-2 rounded-lg flex-shrink-0 ${
              transaction.type === "income"
                ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
            }`}
          >
            {transaction.type === "income" ? (
              <TrendingUp className="h-5 w-5" />
            ) : (
              <TrendingDown className="h-5 w-5" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 mb-1 min-w-0">
              <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white truncate flex-1">
                {transaction.description || "No description"}
              </h3>
              <span
                className={`text-base sm:text-xl font-bold whitespace-nowrap flex-shrink-0 ${
                  transaction.type === "income"
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {transaction.type === "income" ? "+" : "-"}
                {formatCurrency(transaction.amount, currency.locale, currency.code)}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center space-x-1">
                <Tag className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{transaction.category}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                <span>{formatDate(transaction.date)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Edit/Delete Buttons */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="flex items-center space-x-2 flex-shrink-0"
            >
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(transaction);
                }}
                className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors duration-200"
                title="Edit transaction"
              >
                <Edit3 className="h-4 w-4" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(transaction._id);
                }}
                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors duration-200"
                title="Delete transaction"
              >
                <Trash2 className="h-4 w-4" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});
TransactionRow.displayName = "TransactionRow";

// =============================
// TransactionList Component with TanStack Virtual
// =============================
const TransactionList = ({
  transactions,
  onDelete,
  onEdit,
  isLoading = false,
  hasMore = false,
  onLoadMore,
}) => {
  const parentRef = useRef(null);

  // Configure the virtualizer with TanStack Virtual
  const rowVirtualizer = useVirtualizer({
    count: hasMore ? transactions.length + 1 : transactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => 120, []), // Height per row
    overscan: 5, // Number of items to render outside viewport for smooth scrolling
  });

  // Get virtual items
  const virtualItems = rowVirtualizer.getVirtualItems();

  // Handle infinite loading when reaching near the end
  useEffect(() => {
    const [lastItem] = [...virtualItems].reverse();

    if (!lastItem) return;

    // Trigger load more when we're near the end
    if (
      lastItem.index >= transactions.length - 1 &&
      hasMore &&
      !isLoading &&
      onLoadMore
    ) {
      onLoadMore();
    }
  }, [hasMore, isLoading, onLoadMore, transactions.length, virtualItems]);

  // Loading state for initial load
  if (isLoading && transactions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-800">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-16 bg-gray-200 dark:bg-gray-700 rounded-xl"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800"
    >
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-800">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white mb-2">
              Recent Transactions
            </h2>
            <div className="w-[185px] h-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full" />
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {transactions.length} {hasMore ? "+ " : ""}transactions
          </div>
        </motion.div>
      </div>

      {/* Virtualized List Section */}
      <div className="p-2 sm:p-4">
        {transactions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400"
          >
            <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No transactions found</p>
            <p className="text-sm text-center px-4">
              Try adjusting your filters or search terms
            </p>
          </motion.div>
        ) : (
          <div
            ref={parentRef}
            className="h-[600px] overflow-auto custom-scrollbar"
            style={{
              contain: "strict",
            }}
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {virtualItems.map((virtualRow) => {
                const isLoaderRow = virtualRow.index > transactions.length - 1;
                const transaction = transactions[virtualRow.index];

                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {isLoaderRow ? (
                      hasMore ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                          <span className="ml-3 text-sm text-gray-600 dark:text-gray-400">
                            Loading more transactions...
                          </span>
                        </div>
                      ) : null
                    ) : (
                      <TransactionRow
                        transaction={transaction}
                        onEdit={onEdit}
                        onDelete={onDelete}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default TransactionList;
