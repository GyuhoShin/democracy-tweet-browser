import React, { useMemo, useState, useEffect } from "react";
import Papa from "papaparse";

// Single-dataset browser for Democracy_final_raw_data_clean_no_outliers.csv
// Expected headers: Cluster, Topic, Date, Clean, Impact_Factor
// Store the CSV in ../data/; Vite serves that directory at
// ./Democracy_final_raw_data_clean_no_outliers.csv
//
// Optional mapping files in ../data/:
//  - cluster_labels.csv  (columns: Cluster, Cluster_Title)
//  - topic_labels.csv    (columns: Topic, Topic_Title)
// If present, the UI renders labels as "<id>: <title>".

export default function App() {
  // State
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fixed column mapping for this dataset
  const clusterCol = "Cluster";
  const topicCol = "Topic";
  const tweetCol = "Clean"; // tweet text
  const dateCol = "Date";
  const impactCol = "Impact_Factor";

  // Optional label maps
  const [clusterMap, setClusterMap] = useState({}); // { id -> title }
  const [topicMap, setTopicMap] = useState({});     // { id -> title }

  // UI state
  const [selectedClusters, setSelectedClusters] = useState(new Set());
  const [selectedTopics, setSelectedTopics] = useState(new Set());
  const [topicSearch, setTopicSearch] = useState("");
  const [tweetSearch, setTweetSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 100; // fixed page size
  // Sorting state
  const [sortKey, setSortKey] = useState("date"); // 'date' | 'impact'
  const [sortOrder, setSortOrder] = useState("desc"); // 'asc' | 'desc'

  // Date slider (dual handle): start and end adjustable within 2017-01-01..2022-12-31
  const RANGE_MIN = useMemo(() => new Date("2017-01-01"), []);
  const RANGE_MAX = useMemo(() => new Date("2022-12-31"), []);
  const day = 24 * 60 * 60 * 1000;
  const dateToNum = (d) => {
    const t = new Date(d).getTime();
    if (!Number.isFinite(t)) return NaN;
    return Math.floor((t - RANGE_MIN.getTime()) / day);
  };
  const numToDate = (n) => new Date(RANGE_MIN.getTime() + n * day);

  const sliderMin = 0;
  const sliderMax = Math.floor((RANGE_MAX.getTime() - RANGE_MIN.getTime()) / day);
  const [rangeStart, setRangeStart] = useState(sliderMin);
  const [rangeEnd, setRangeEnd] = useState(sliderMax);

  // Load the fixed CSV on mount
  useEffect(() => {
    const url = "./Democracy_final_raw_data_clean_no_outliers.csv";
    (async () => {
      try {
        const resp = await fetch(url, { cache: "no-store" });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const text = await resp.text();
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
          complete: (res) => {
            const parsed = (res.data || []).filter(r => r && Object.keys(r).length > 0);
            setRows(parsed);
            setLoading(false);
          },
          error: (err) => {
            setError("CSV parse error: " + err.message);
            setLoading(false);
          }
        });
      } catch (e) {
        setError(String(e.message || e));
        setLoading(false);
      }
    })();
  }, []);

  // Try to load optional label maps (ignore if missing)
  useEffect(() => {
    const loadMap = async (path, key, val, setter) => {
      try {
        const r = await fetch(path, { cache: "no-store" });
        if (!r.ok) return; // silently ignore if 404
        const text = await r.text();
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
          complete: (res) => {
            const map = {};
            for (const row of res.data || []) {
              if (row && row[key] != null && row[val] != null && row[val] !== "") {
                map[String(row[key])] = String(row[val]);
              }
            }
            setter(map);
          }
        });
      } catch {
        // ignore
      }
    };

    loadMap("./cluster_labels.csv", "Cluster", "Cluster_Title", setClusterMap);
    loadMap("./topic_labels.csv", "Topic", "Topic_Title", setTopicMap);
  }, []);

  // When global search keyword or date range changes, reset pagination.
  useEffect(() => { setPage(1); }, [tweetSearch, rangeStart, rangeEnd]);

  // --- Base filtering (GLOBAL) ---
  // Applies keyword and date-range filters BEFORE building clusters/topics.
  const baseFilteredRows = useMemo(() => {
    const q = tweetSearch.trim().toLowerCase();
    const out = [];
    for (const r of rows) {
      // date filter: from selected start to selected end
      const num = dateToNum(r[dateCol]);
      if (!Number.isFinite(num)) continue; // drop rows with invalid date
      if (num < rangeStart || num > rangeEnd) continue;
      // keyword filter (tweet text only)
      if (q && !String(r[tweetCol]).toLowerCase().includes(q)) continue;
      out.push(r);
    }
    return out;
  }, [rows, tweetSearch, rangeStart, rangeEnd]);

  // Derived: clusters list with counts from baseFilteredRows
  const clusters = useMemo(() => {
    const counts = new Map();
    for (const r of baseFilteredRows) {
      const c = r[clusterCol];
      if (c == null || c === "") continue;
      counts.set(c, (counts.get(c) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => String(a.value).localeCompare(String(b.value), undefined, { numeric: true }));
  }, [baseFilteredRows]);

  // Topics available given selected clusters (from baseFilteredRows)
  const topics = useMemo(() => {
    const clusterSet = selectedClusters.size ? selectedClusters : new Set(clusters.map(c => c.value));
    const counts = new Map();
    for (const r of baseFilteredRows) {
      const c = r[clusterCol];
      const t = r[topicCol];
      if (!clusterSet.has(c) || t == null || t === "") continue;
      counts.set(t, (counts.get(t) || 0) + 1);
    }
    let arr = Array.from(counts.entries()).map(([value, count]) => ({ value, count }));
    if (topicSearch.trim()) {
      const q = topicSearch.toLowerCase();
      arr = arr.filter(x => String(x.value).toLowerCase().includes(q) || (topicMap[String(x.value)] || "").toLowerCase().includes(q));
    }
    arr.sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value), undefined, { numeric: true }));
    return arr;
  }, [baseFilteredRows, clusters, selectedClusters, topicSearch, topicMap]);

  // Filtered tweets (cluster/topic filters applied to baseFilteredRows)
  const filtered = useMemo(() => {
    const clusterSet = selectedClusters.size ? selectedClusters : new Set(clusters.map(c => c.value));
    const topicSet = selectedTopics.size ? selectedTopics : new Set(topics.map(t => t.value));
    const out = [];
    for (const r of baseFilteredRows) {
      if (!clusterSet.has(r[clusterCol])) continue;
      if (!topicSet.has(r[topicCol])) continue;
      out.push(r);
    }
    return out;
  }, [baseFilteredRows, clusters, topics, selectedClusters, selectedTopics]);

  // Sorting (applies before pagination)
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const safeNum = (x) => {
      const n = typeof x === 'number' ? x : parseFloat(x);
      return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
    };
    const safeDate = (x) => {
      const d = new Date(x);
      const t = d.getTime();
      return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
    };
    arr.sort((a, b) => {
      if (sortKey === "date") {
        const diff = safeDate(a[dateCol]) - safeDate(b[dateCol]);
        return sortOrder === "asc" ? diff : -diff;
      }
      if (sortKey === "impact") {
        const diff = safeNum(a[impactCol]) - safeNum(b[impactCol]);
        return sortOrder === "asc" ? diff : -diff;
      }
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortOrder]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => { if (page > totalPages) setPage(1); }, [sorted.length, totalPages]);
  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page]);

  // Actions
  function toggleCluster(val) {
    const next = new Set(selectedClusters);
    next.has(val) ? next.delete(val) : next.add(val);
    setSelectedClusters(next);
    // drop topics that are no longer available
    setSelectedTopics(prev => {
      const avail = new Set(topics.map(t => t.value));
      return new Set(Array.from(prev).filter(v => avail.has(v)));
    });
    setPage(1);
  }
  function toggleTopic(val) {
    const next = new Set(selectedTopics);
    next.has(val) ? next.delete(val) : next.add(val);
    setSelectedTopics(next);
    setPage(1);
  }
  function selectAllClusters() { setSelectedClusters(new Set(clusters.map(c => c.value))); }
  function clearClusters() { setSelectedClusters(new Set()); }
  function selectAllTopics() { setSelectedTopics(new Set(topics.map(t => t.value))); }
  function clearTopics() { setSelectedTopics(new Set()); }

  // --- Dev sanity tests (run once after base filter available) ---
  useEffect(() => {
    if (!baseFilteredRows.length) return;
    try {
      const nums = baseFilteredRows.slice(0, 10).map(r => dateToNum(r[dateCol]));
      if (nums.some(n => !Number.isFinite(n))) console.warn("[TEST] some dates invalid in sample");
      const impacts = baseFilteredRows.slice(0, 10).map(r => parseFloat(r[impactCol]));
      if (impacts.some(v => Number.isNaN(v))) console.warn("[TEST] some impacts non-numeric in sample");
    } catch (e) {
      console.warn("[TEST] sanity tests issue:", e);
    }
  }, [baseFilteredRows]);

  // Test: slider invariants (dev)
  useEffect(() => {
    if (rangeStart > rangeEnd) {
      console.warn("[TEST] rangeStart exceeded rangeEnd; correcting");
      setRangeStart((s) => Math.min(s, rangeEnd));
    }
    if (rangeStart < sliderMin || rangeEnd > sliderMax) {
      console.warn("[TEST] range bounds exceeded; correcting");
      setRangeStart((s) => Math.max(s, sliderMin));
      setRangeEnd((e) => Math.min(e, sliderMax));
    }
  }, [rangeStart, rangeEnd]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">Loading CSV…</div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>
    );
  }

  const prettyDate = (d) => {
    try {
      return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' }).format(d);
    } catch {
      return String(d);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
          <h1 className="text-xl font-semibold">Democracy Tweets Browser</h1>
          {/* Global tweet keyword search moved to header */}
          <input
            value={tweetSearch}
            onChange={(e) => setTweetSearch(e.target.value)}
            placeholder="Search tweets (global)"
            className="w-full md:w-96 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Global tweet search"
          />
        </div>
      </header>

      {/* Inline styles for dual-range slider (both thumbs draggable) */}
      <style>{`
        input.dual-range{position:absolute;width:100%;background:transparent;appearance:none;-webkit-appearance:none;pointer-events:none;height:0}
        input.dual-range:focus{outline:none}
        input.dual-range::-webkit-slider-runnable-track{height:4px;background:transparent}
        input.dual-range::-moz-range-track{height:4px;background:transparent}
        input.dual-range::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:16px;height:16px;border-radius:9999px;background:#4f46e5;border:2px solid #fff;box-shadow:0 0 0 1px #c7d2fe;margin-top:-6px;pointer-events:all}
        input.dual-range::-moz-range-thumb{width:16px;height:16px;border-radius:9999px;background:#4f46e5;border:2px solid #fff;pointer-events:all}
      `}</style>

      <main className="mx-auto max-w-7xl px-4 py-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          {/* Clusters */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium">Clusters <span className="text-xs text-gray-500">({clusters.length})</span></h2>
              <div className="flex gap-2">
                <button onClick={selectAllClusters} className="text-xs rounded border px-2 py-1 hover:bg-gray-50">All</button>
                <button onClick={clearClusters} className="text-xs rounded border px-2 py-1 hover:bg-gray-50">Clear</button>
              </div>
            </div>
            <div className="max-h-[60vh] overflow-auto pr-1">
              {clusters.map(({ value, count }) => (
                <label key={String(value)} className="flex items-center justify-between gap-3 py-1">
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedClusters.has(value)}
                      onChange={() => toggleCluster(value)}
                    />
                    <span className="font-mono">
                      {clusterMap[String(value)] ? `${value}: ${clusterMap[String(value)]}` : String(value)}
                    </span>
                  </span>
                  <span className="text-xs text-gray-600">{count.toLocaleString()}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Topics */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-medium">Topics <span className="text-xs text-gray-500">({topics.length})</span></h2>
              <div className="flex gap-2">
                <button onClick={selectAllTopics} className="text-xs rounded border px-2 py-1 hover:bg-gray-50">All</button>
                <button onClick={clearTopics} className="text-xs rounded border px-2 py-1 hover:bg-gray-50">Clear</button>
              </div>
            </div>
            <input
              value={topicSearch}
              onChange={(e) => setTopicSearch(e.target.value)}
              placeholder="Search topics (id or title)"
              className="w-full mb-3 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="max-h-[60vh] overflow-auto pr-1">
              {topics.map(({ value, count }) => (
                <button
                  key={String(value)}
                  onClick={() => toggleTopic(value)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between hover:bg-gray-50 ${selectedTopics.has(value) ? "bg-indigo-50 border border-indigo-200" : ""}`}
                >
                  <span className="truncate" title={String(value)}>
                    {topicMap[String(value)] ? `${value}: ${topicMap[String(value)]}` : String(value)}
                  </span>
                  <span className="text-xs text-gray-600">{count.toLocaleString()}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Tweets */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="font-medium">Tweets <span className="text-xs text-gray-500">({filtered.length.toLocaleString()})</span></h2>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1">
                  <label className="text-gray-600">Sort</label>
                  <select value={sortKey} onChange={(e)=>{ setSortKey(e.target.value); setPage(1); }} className="rounded border px-2 py-1">
                    <option value="date">Date</option>
                    <option value="impact">Impact</option>
                  </select>
                  <select value={sortOrder} onChange={(e)=>{ setSortOrder(e.target.value); setPage(1); }} className="rounded border px-2 py-1">
                    <option value="desc">Desc</option>
                    <option value="asc">Asc</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Dual date range slider: both start and end handles on one track (two inputs overlaid) */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>{prettyDate(numToDate(rangeStart))}</span>
                <span>{prettyDate(numToDate(rangeEnd))}</span>
              </div>
              <div className="relative h-6 flex items-center select-none">
                {/* track background */}
                <div className="absolute left-0 right-0 h-1 bg-gray-200 rounded-full"/>
                {/* range highlight */}
                <div
                  className="absolute h-1 bg-indigo-400 rounded-full"
                  style={{
                    left: `${(rangeStart - sliderMin) / (sliderMax - sliderMin) * 100}%`,
                    right: `${100 - (rangeEnd - sliderMin) / (sliderMax - sliderMin) * 100}%`
                  }}
                />
                {/* left (start) handle */}
                <input
                  type="range"
                  min={sliderMin}
                  max={sliderMax}
                  step={1}
                  value={rangeStart}
                  onChange={(e)=>{
                    const v = Math.min(Number(e.target.value), rangeEnd);
                    setRangeStart(v);
                  }}
                  className="dual-range"
                  aria-label="Start date"
                />
                {/* right (end) handle */}
                <input
                  type="range"
                  min={sliderMin}
                  max={sliderMax}
                  step={1}
                  value={rangeEnd}
                  onChange={(e)=>{
                    const v = Math.max(Number(e.target.value), rangeStart);
                    setRangeEnd(v);
                  }}
                  className="dual-range"
                  aria-label="End date"
                />
              </div>
              <div className="text-xs text-gray-600 mt-1">Range: {prettyDate(numToDate(rangeStart))} – {prettyDate(numToDate(rangeEnd))}</div>
            </div>

            {!pageRows.length ? (
              <div className="text-sm text-gray-600">No tweets match your filters.</div>
            ) : (
              <ul className="space-y-2 max-h-[52vh] overflow-auto pr-1">
                {pageRows.map((r, i) => (
                  <li key={`${page}-${i}`} className="rounded-xl border border-gray-200 p-3 hover:bg-gray-50">
                    <div className="text-xs text-gray-500 mb-1 flex flex-wrap gap-2">
                      <span>Cluster <span className="font-mono">{clusterMap[String(r[clusterCol])] ? `${String(r[clusterCol])}: ${clusterMap[String(r[clusterCol])]}` : String(r[clusterCol])}</span></span>
                      <span>· Topic <span className="font-semibold">{topicMap[String(r[topicCol])] ? `${String(r[topicCol])}: ${topicMap[String(r[topicCol])]}` : String(r[topicCol])}</span></span>
                      {r[impactCol] != null && <span>· Impact {String(r[impactCol])}</span>}
                      {r[dateCol] != null && <span>· {String(r[dateCol])}</span>}
                    </div>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">{String(r[tweetCol])}</div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex items-center justify-between">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
              >Prev</button>
              <div className="text-sm">Page {page} / {totalPages}</div>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
              >Next</button>
            </div>
          </section>
        </div>
      </main>

      <footer className="mx-auto max-w-7xl px-4 py-6 text-xs text-gray-500">
        <p>This page reads a fixed CSV bundled with the site. Global search and date range slider affect clusters, topics, and tweets.</p>
      </footer>
    </div>
  );
}
