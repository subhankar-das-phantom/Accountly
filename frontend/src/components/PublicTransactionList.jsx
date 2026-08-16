import React, { useRef, useEffect, useCallback } from 'react';
import useSWRInfinite from 'swr/infinite';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useInView } from 'react-intersection-observer';
import { format } from 'date-fns';
import { formatCurrency } from '../utils/currency';
import { User, Tag, Calendar, AlertCircle } from 'lucide-react';

const fetcher = (url) => fetch(url).then(res => res.json());

const PublicTransactionList = ({ type, slug, currency }) => {
  const getKey = (pageIndex, previousPageData) => {
    // If we've reached the end, return null
    if (previousPageData && previousPageData.pagination && pageIndex >= previousPageData.pagination.pages) {
      return null;
    }
    // Add 1 to pageIndex because API is 1-indexed
    return `${import.meta.env.VITE_API_URL}/public/organizations/${slug}/${type === 'contributions' ? 'contributions' : 'expenses'}?page=${pageIndex + 1}&limit=20`;
  };

  const { data, error, size, setSize, isValidating } = useSWRInfinite(getKey, fetcher, {
    revalidateOnFocus: false,
    revalidateFirstPage: false
  });

  const parentRef = useRef(null);
  const { ref: loadMoreRef, inView } = useInView();

  // Flatten the pages into a single array
  const flatData = data ? data.flatMap(page => page[type === 'contributions' ? 'contributions' : 'expenses']) : [];
  
  const isLoadingInitialData = !data && !error;
  const totalDBRows = data?.[0]?.pagination?.total || 0;
  const totalFetched = flatData.length;
  const isReachingEnd = flatData.length >= totalDBRows;
  
  const isLoadingMore = isLoadingInitialData || (size > 0 && data && typeof data[size - 1] === "undefined");
  const isEmpty = data?.[0]?.[type === 'contributions' ? 'contributions' : 'expenses']?.length === 0;

  useEffect(() => {
    if (inView && !isReachingEnd && !isValidating) {
      setSize(size + 1);
    }
  }, [inView, isReachingEnd, setSize, size, isValidating]);

  const rowVirtualizer = useVirtualizer({
    count: flatData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5,
  });

  if (error) {
    return (
      <div className="p-4 text-red-500 bg-red-50 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
        <AlertCircle className="w-5 h-5 mr-2" />
        Failed to load {type === 'contributions' ? 'contributions' : 'expenses'}.
      </div>
    );
  }

  return (
    <div className="w-full">
      <div 
        ref={parentRef} 
        className="max-h-[500px] overflow-auto border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 custom-scrollbar"
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const item = flatData[virtualRow.index];
            if (!item) return null;

            return (
              <div
                key={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors px-6 flex items-center justify-between"
              >
                <div className="flex flex-col justify-center h-full">
                  <div className="flex items-center text-sm font-medium text-gray-900 dark:text-white mb-1">
                    {type === 'contributions' ? (
                      <>
                        <User className="w-4 h-4 mr-2 text-blue-500" />
                        {item.contributorName}
                      </>
                    ) : (
                      <>
                        <Tag className="w-4 h-4 mr-2 text-red-500" />
                        {item.category}
                      </>
                    )}
                  </div>
                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                    <Calendar className="w-3 h-3 mr-1" />
                    {format(new Date(item.date), 'MMM dd, yyyy')}
                    {type === 'expense' && item.recipientName && (
                      <span className="ml-3 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full">
                        To: {item.recipientName}
                      </span>
                    )}
                  </div>
                </div>
                <div className={`font-semibold ${type === 'contributions' ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                  {type === 'contributions' ? '+' : ''}
                  {formatCurrency(item.amount, currency.locale, currency.code)}
                </div>
              </div>
            );
          })}
        </div>

        {isEmpty && (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No {type === 'contributions' ? 'contributions' : 'expenses'} found.
          </div>
        )}

        {/* Loading trigger at the bottom */}
        <div ref={loadMoreRef} className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
          {isValidating && !isReachingEnd ? 'Loading more...' : ''}
          {isReachingEnd && !isEmpty ? 'End of list.' : ''}
        </div>
      </div>
    </div>
  );
};

export default PublicTransactionList;
