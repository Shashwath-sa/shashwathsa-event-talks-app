/**
 * BigQuery Release Notes Viewer - Client Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // Application State
    let appState = {
        allNotes: [],       // Raw data from API
        filteredNotes: [],  // Data after applying search and category filters
        activeFilter: 'all',// Current category filter
        searchQuery: '',     // Current search text
        activeTweetText: '', // Text currently inside the tweet composer
        isRefreshing: false
    };

    // DOM Elements
    const elements = {
        btnRefresh: document.getElementById('btn-refresh'),
        refreshIcon: document.getElementById('refresh-icon'),
        lastUpdatedText: document.getElementById('last-updated-text'),
        searchInput: document.getElementById('search-input'),
        searchClear: document.getElementById('search-clear'),
        filterButtons: document.querySelectorAll('.filter-group .filter-btn'),
        notesContent: document.getElementById('notes-content'),
        loadingSkeletons: document.getElementById('loading-skeletons'),
        emptyState: document.getElementById('empty-state'),
        btnResetFilters: document.getElementById('btn-reset-filters'),
        
        // Counters
        countTotal: document.getElementById('count-total'),
        countFeatures: document.getElementById('count-features'),
        countIssues: document.getElementById('count-issues'),
        countOther: document.getElementById('count-other'),
        
        // Modal
        tweetModal: document.getElementById('tweet-modal'),
        modalClose: document.getElementById('modal-close'),
        tweetTextarea: document.getElementById('tweet-textarea'),
        charCount: document.getElementById('char-count'),
        charWarningMsg: document.getElementById('char-warning-msg'),
        tweetPreviewText: document.getElementById('tweet-preview-text'),
        btnCopyTweet: document.getElementById('btn-copy-tweet'),
        btnPostTweet: document.getElementById('btn-post-tweet'),
        
        // Toast Container
        toastContainer: document.getElementById('toast-container')
    };

    // ==========================================================================
    // INITIALIZATION & FETCHING
    // ==========================================================================
    
    // Fetch release notes on load
    fetchNotes(false);

    // Refresh button event listener
    elements.btnRefresh.addEventListener('click', () => {
        if (!appState.isRefreshing) {
            fetchNotes(true);
        }
    });

    // Reset filters empty state button
    elements.btnResetFilters.addEventListener('click', resetFilters);

    /**
     * Fetches notes from Flask backend API.
     * @param {boolean} forceRefresh - If true, bypasses server-side cache.
     */
    async function fetchNotes(forceRefresh = false) {
        setLoadingState(true);
        
        try {
            const response = await fetch(`/api/notes?refresh=${forceRefresh}`);
            const result = await response.json();
            
            if (result.success && result.notes) {
                appState.allNotes = result.notes;
                elements.lastUpdatedText.textContent = `Sync: ${result.last_updated}`;
                
                // Calculate and animate statistics
                calculateStats(result.notes);
                
                // Render the stream
                applyFilters();
                
                if (forceRefresh) {
                    showToast('Successfully fetched latest release notes', 'success');
                }
            } else {
                throw new Error(result.error || 'Unknown server error');
            }
        } catch (error) {
            console.error('Error fetching release notes:', error);
            showToast(`Error: ${error.message || 'Failed to connect to server'}`, 'error');
            elements.lastUpdatedText.textContent = 'Sync failed';
            
            // If we have no data, show empty state with error notice
            if (appState.allNotes.length === 0) {
                elements.notesContent.innerHTML = '';
                elements.emptyState.style.display = 'flex';
                elements.emptyState.querySelector('h3').textContent = 'Could not retrieve release notes';
                elements.emptyState.querySelector('p').textContent = 'Please check your internet connection and try again.';
            }
        } finally {
            setLoadingState(false);
        }
    }

    /**
     * Toggles loading states across the UI.
     * @param {boolean} isLoading 
     */
    function setLoadingState(isLoading) {
        appState.isRefreshing = isLoading;
        
        if (isLoading) {
            elements.refreshIcon.classList.add('spinning');
            elements.btnRefresh.disabled = true;
            elements.loadingSkeletons.style.display = 'block';
            elements.notesContent.style.display = 'none';
            elements.emptyState.style.display = 'none';
        } else {
            elements.refreshIcon.classList.remove('spinning');
            elements.btnRefresh.disabled = false;
            elements.loadingSkeletons.style.display = 'none';
            elements.notesContent.style.display = 'block';
        }
    }

    // ==========================================================================
    // FILTER & SEARCH LOGIC
    // ==========================================================================
    
    // Search input change listener
    elements.searchInput.addEventListener('input', (e) => {
        appState.searchQuery = e.target.value.trim().toLowerCase();
        
        // Toggle search clear button visibility
        if (appState.searchQuery.length > 0) {
            elements.searchClear.style.display = 'block';
        } else {
            elements.searchClear.style.display = 'none';
        }
        
        applyFilters();
    });

    // Clear search button click
    elements.searchClear.addEventListener('click', () => {
        elements.searchInput.value = '';
        appState.searchQuery = '';
        elements.searchClear.style.display = 'none';
        elements.searchInput.focus();
        applyFilters();
    });

    // Category filter button click
    elements.filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            elements.filterButtons.forEach(b => b.classList.remove('active'));
            
            // Handle clicking inner dot spans
            const filterTarget = e.currentTarget;
            filterTarget.classList.add('active');
            
            appState.activeFilter = filterTarget.getAttribute('data-filter');
            applyFilters();
        });
    });

    /**
     * Resets all search queries and active category tags.
     */
    function resetFilters() {
        elements.searchInput.value = '';
        appState.searchQuery = '';
        elements.searchClear.style.display = 'none';
        
        elements.filterButtons.forEach(b => {
            if (b.getAttribute('data-filter') === 'all') {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        });
        
        appState.activeFilter = 'all';
        applyFilters();
    }

    /**
     * Filters release notes in real-time based on category and query.
     */
    function applyFilters() {
        const query = appState.searchQuery;
        const catFilter = appState.activeFilter;
        
        let filteredData = [];

        appState.allNotes.forEach(day => {
            // Filter updates within the day
            const matchingUpdates = day.updates.filter(update => {
                // Check category filter
                const matchesCategory = (catFilter === 'all') || (update.type.toLowerCase() === catFilter.toLowerCase());
                
                // Check search text query filter
                let matchesSearch = true;
                if (query) {
                    const updateContentText = update.content_html.toLowerCase();
                    const updateTypeText = update.type.toLowerCase();
                    const dayDateText = day.date.toLowerCase();
                    
                    matchesSearch = updateContentText.includes(query) || 
                                    updateTypeText.includes(query) || 
                                    dayDateText.includes(query);
                }
                
                return matchesCategory && matchesSearch;
            });

            // If this day has updates matching the filters, include it
            if (matchingUpdates.length > 0) {
                filteredData.push({
                    ...day,
                    updates: matchingUpdates
                });
            }
        });

        appState.filteredNotes = filteredData;
        renderNotes(filteredData);
    }

    // ==========================================================================
    // RENDERING
    // ==========================================================================
    
    /**
     * Renders the release notes timeline cards to the DOM.
     * @param {Array} daysList 
     */
    function renderNotes(daysList) {
        elements.notesContent.innerHTML = '';
        
        if (daysList.length === 0) {
            elements.emptyState.style.display = 'flex';
            return;
        }
        
        elements.emptyState.style.display = 'none';
        
        daysList.forEach(day => {
            // Create day container
            const dayContainer = document.createElement('article');
            dayContainer.className = 'day-container';
            dayContainer.setAttribute('aria-label', `Updates for ${day.date}`);
            
            // Create day sidebar header
            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header';
            
            const dayTitle = document.createElement('h2');
            dayTitle.className = 'day-title';
            dayTitle.textContent = day.date;
            
            const dayLink = document.createElement('a');
            dayLink.className = 'day-meta-link';
            dayLink.href = day.link;
            dayLink.target = '_blank';
            dayLink.rel = 'noopener noreferrer';
            dayLink.innerHTML = `<i class="fa-solid fa-arrow-up-right-from-square"></i> Original notes`;
            
            dayHeader.appendChild(dayTitle);
            dayHeader.appendChild(dayLink);
            dayContainer.appendChild(dayHeader);
            
            // Create updates list for this day
            const updatesList = document.createElement('div');
            updatesList.className = 'day-updates-list';
            
            day.updates.forEach((update, index) => {
                const updateCard = document.createElement('div');
                
                // Determine card color class based on update type
                let typeClass = 'general-card';
                let typeLower = update.type.toLowerCase();
                if (typeLower.includes('feature')) typeClass = 'feature-card';
                else if (typeLower.includes('issue') || typeLower.includes('fix')) typeClass = 'issue-card';
                else if (typeLower.includes('change')) typeClass = 'change-card';
                else if (typeLower.includes('deprecation')) typeClass = 'deprecation-card';
                
                updateCard.className = `update-card ${typeClass}`;
                
                // Card header (Badge and Tweet action)
                const cardHeader = document.createElement('div');
                cardHeader.className = 'card-header';
                
                // Badge
                let badgeClass = 'general-badge';
                if (typeLower.includes('feature')) badgeClass = 'feature-badge';
                else if (typeLower.includes('issue') || typeLower.includes('fix')) badgeClass = 'issue-badge';
                else if (typeLower.includes('change')) badgeClass = 'change-badge';
                else if (typeLower.includes('deprecation')) badgeClass = 'deprecation-badge';
                
                const badge = document.createElement('span');
                badge.className = `badge ${badgeClass}`;
                
                // Set icon based on type
                let badgeIcon = '<i class="fa-solid fa-circle-info"></i>';
                if (typeLower.includes('feature')) badgeIcon = '<i class="fa-solid fa-wand-magic-sparkles"></i>';
                else if (typeLower.includes('issue') || typeLower.includes('fix')) badgeIcon = '<i class="fa-solid fa-circle-exclamation"></i>';
                else if (typeLower.includes('change')) badgeIcon = '<i class="fa-solid fa-sliders"></i>';
                else if (typeLower.includes('deprecation')) badgeIcon = '<i class="fa-solid fa-triangle-exclamation"></i>';
                
                badge.innerHTML = `${badgeIcon} ${update.type}`;
                cardHeader.appendChild(badge);
                
                // Tweet action button
                const tweetBtn = document.createElement('button');
                tweetBtn.className = 'btn-tweet-card';
                tweetBtn.innerHTML = `<i class="fa-brands fa-x-twitter"></i> Tweet`;
                tweetBtn.setAttribute('aria-label', `Tweet this update from ${day.date}`);
                
                tweetBtn.addEventListener('click', () => {
                    openTweetComposer(update.tweet_text);
                });
                
                cardHeader.appendChild(tweetBtn);
                updateCard.appendChild(cardHeader);
                
                // Card body content
                const cardBody = document.createElement('div');
                cardBody.className = 'card-body';
                cardBody.innerHTML = update.content_html;
                
                updateCard.appendChild(cardBody);
                updatesList.appendChild(updateCard);
            });
            
            dayContainer.appendChild(updatesList);
            elements.notesContent.appendChild(dayContainer);
        });
    }

    // ==========================================================================
    // COUNTER STATISTICS ANIMATION
    // ==========================================================================
    
    /**
     * Calculates and triggers animation updates for counter cards.
     * @param {Array} notes 
     */
    function calculateStats(notes) {
        let total = 0;
        let features = 0;
        let issues = 0;
        let other = 0;
        
        notes.forEach(day => {
            day.updates.forEach(update => {
                total++;
                let type = update.type.toLowerCase();
                if (type.includes('feature')) {
                    features++;
                } else if (type.includes('issue') || type.includes('fix')) {
                    issues++;
                } else {
                    other++;
                }
            });
        });
        
        // Animate counter values
        animateCounter(elements.countTotal, total);
        animateCounter(elements.countFeatures, features);
        animateCounter(elements.countIssues, issues);
        animateCounter(elements.countOther, other);
    }

    /**
     * Smoothly counts up a DOM element's text content to a target number.
     * @param {HTMLElement} element 
     * @param {number} targetValue 
     */
    function animateCounter(element, targetValue) {
        const startValue = parseInt(element.textContent, 10) || 0;
        if (startValue === targetValue) return;
        
        const duration = 800; // ms
        const startTime = performance.now();
        
        function updateCounter(currentTime) {
            const elapsedTime = currentTime - startTime;
            if (elapsedTime >= duration) {
                element.textContent = targetValue;
                return;
            }
            
            const progress = elapsedTime / duration;
            // Ease-out-quad function
            const easeProgress = progress * (2 - progress);
            const currentValue = Math.floor(startValue + (targetValue - startValue) * easeProgress);
            
            element.textContent = currentValue;
            requestAnimationFrame(updateCounter);
        }
        
        requestAnimationFrame(updateCounter);
    }

    // ==========================================================================
    // TWEET MODAL COMPOSER
    // ==========================================================================
    
    // Textarea input event listeners for live count and preview formatting
    elements.tweetTextarea.addEventListener('input', (e) => {
        updateTweetText(e.target.value);
    });

    // Close buttons on modal
    elements.modalClose.addEventListener('click', closeTweetComposer);
    
    // Close modal when clicking outside content area
    elements.tweetModal.addEventListener('click', (e) => {
        if (e.target === elements.tweetModal) {
            closeTweetComposer();
        }
    });

    // Post to Twitter click
    elements.btnPostTweet.addEventListener('click', () => {
        const tweetText = elements.tweetTextarea.value;
        const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
        window.open(shareUrl, '_blank', 'noopener,noreferrer');
        closeTweetComposer();
        showToast('Redirected to X to publish your post!', 'success');
    });

    // Copy to clipboard click
    elements.btnCopyTweet.addEventListener('click', async () => {
        const text = elements.tweetTextarea.value;
        try {
            await navigator.clipboard.writeText(text);
            showToast('Post copied to clipboard!', 'success');
        } catch (err) {
            console.error('Failed to copy to clipboard', err);
            // Fallback for older browsers
            elements.tweetTextarea.select();
            document.execCommand('copy');
            showToast('Post copied to clipboard!', 'success');
        }
    });

    /**
     * Opens the tweet composer modal with initial text.
     * @param {string} text 
     */
    function openTweetComposer(text) {
        elements.tweetModal.classList.add('active');
        elements.tweetModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden'; // Stop page scrolling background
        elements.tweetTextarea.value = text;
        updateTweetText(text);
        
        // Auto focus and set cursor to start
        elements.tweetTextarea.focus();
        elements.tweetTextarea.setSelectionRange(0, 0);
    }

    /**
     * Closes the tweet composer modal.
     */
    function closeTweetComposer() {
        elements.tweetModal.classList.remove('active');
        elements.tweetModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = ''; // Restore page scrolling
    }

    /**
     * Syncs textarea changes to character count UI and mock preview card.
     * @param {string} text 
     */
    function updateTweetText(text) {
        const len = text.length;
        elements.charCount.textContent = len;
        
        // Highlight count and show warnings if exceeding limits
        if (len > 280) {
            elements.charCount.style.color = 'var(--color-red)';
            elements.charWarningMsg.style.display = 'block';
            elements.btnPostTweet.classList.add('btn-warning');
        } else {
            elements.charCount.style.color = len >= 260 ? 'var(--color-amber)' : 'var(--text-secondary)';
            elements.charWarningMsg.style.display = 'none';
            elements.btnPostTweet.classList.remove('btn-warning');
        }
        
        // Update mock preview HTML with styled links & hashtags
        elements.tweetPreviewText.innerHTML = formatMockTweetText(text);
    }

    /**
     * Parses hashtags and links in plain text to generate styled HTML tags.
     * @param {string} text 
     */
    function formatMockTweetText(text) {
        if (!text) return 'Drafting your post...';
        
        // Escape HTML tags to prevent XSS in draft preview
        let escapedText = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
            
        // Regex patterns
        const hashtagRegex = /(#[a-zA-Z0-9_]+)/g;
        // Match standard HTTP links inside parentheses or standalone
        const urlRegex = /(https?:\/\/[^\s\)]+)/g;

        // Wrap hashtags in stylised span
        escapedText = escapedText.replace(hashtagRegex, '<span style="color: var(--color-primary); font-weight: 500;">$1</span>');
        
        // Wrap urls in links (preview only)
        escapedText = escapedText.replace(urlRegex, '<a href="$1" target="_blank" style="color: var(--color-primary); text-decoration: none;">$1</a>');
        
        return escapedText;
    }

    // ==========================================================================
    // TOAST SYSTEM
    // ==========================================================================
    
    /**
     * Spawns a floating toast message.
     * @param {string} message 
     * @param {string} type - 'success' or 'error' 
     */
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = '<i class="fa-solid fa-circle-check toast-icon"></i>';
        if (type === 'error') {
            icon = '<i class="fa-solid fa-circle-exclamation toast-icon"></i>';
        }
        
        toast.innerHTML = `
            ${icon}
            <span class="toast-message">${message}</span>
            <button class="toast-close" aria-label="Close message"><i class="fa-solid fa-xmark"></i></button>
        `;
        
        elements.toastContainer.appendChild(toast);
        
        // Slide in animation delay
        setTimeout(() => {
            toast.classList.add('active');
        }, 10);
        
        // Event listener to close toast manually
        toast.querySelector('.toast-close').addEventListener('click', () => {
            removeToast(toast);
        });
        
        // Auto remove toast after 4s
        const autoTimeout = setTimeout(() => {
            removeToast(toast);
        }, 4000);
        
        function removeToast(el) {
            clearTimeout(autoTimeout);
            el.classList.remove('active');
            
            // Wait for slide out animation to complete
            el.addEventListener('transitionend', () => {
                el.remove();
            });
        }
    }
});
