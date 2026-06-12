import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface SearchFilters {
    startDate: string;
    endDate: string;
    status: string;
    amount: string; // 'lte20k' | 'gt20k' | ''
    customSearch: string;
    planStartDate: string;
    planEndDate: string;
    installmentCountGte: string;
    installmentCountLte: string;
}

export const defaultFilters: SearchFilters = {
    startDate: '',
    endDate: '',
    status: '',
    amount: '',
    customSearch: '',
    planStartDate: '',
    planEndDate: '',
    installmentCountGte: '',
    installmentCountLte: ''
};

interface AdvancedSearchFilterProps {
    onSearch: (filters: SearchFilters) => void;
    onReset: () => void;
    hideStatus?: boolean;
}

export function AdvancedSearchFilter({ 
    onSearch, 
    onReset, 
    hideStatus = false
}: AdvancedSearchFilterProps) {
    const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
    const [expanded, setExpanded] = useState(false);

    const handleChange = (key: keyof SearchFilters, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleSearch = () => {
        onSearch(filters);
    };

    const handleReset = () => {
        setFilters(defaultFilters);
        onReset();
    };

    // 按下 Enter 鍵時觸發搜尋
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    return (
        <div className="bg-white dark:bg-slate-950 border rounded-lg shadow-sm mb-6 p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end">
                <div className="flex-1">
                    <label className="text-sm font-medium text-muted-foreground mb-1 block">自訂搜尋 (關鍵字)</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="多關鍵字空白分割(AND)搜尋，支援搜尋單號、開單人、承辦人、廠商或內容等..."
                            value={filters.customSearch}
                            onChange={(e) => handleChange('customSearch', e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="pl-9 w-full"
                        />
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
                    <Button onClick={handleSearch} className="bg-green-600 hover:bg-green-700 text-white flex-1 sm:flex-initial justify-center">
                        <Search className="w-4 h-4 mr-2" />
                        搜尋
                    </Button>
                    <Button variant="outline" onClick={handleReset} className="flex-1 sm:flex-initial justify-center">
                        <X className="w-4 h-4 mr-2" />
                        清除
                    </Button>
                    <Button variant="ghost" onClick={() => setExpanded(!expanded)} className="text-muted-foreground flex-1 sm:flex-initial justify-center whitespace-nowrap">
                        {expanded ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                        {expanded ? '收起進階條件' : '展開進階條件'}
                    </Button>
                </div>
            </div>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t" onKeyDown={handleKeyDown}>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground mb-1 block">開始日期</label>
                                <Input type="date" value={filters.startDate} onChange={(e) => handleChange('startDate', e.target.value)} />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground mb-1 block">結束日期</label>
                                <Input type="date" value={filters.endDate} onChange={(e) => handleChange('endDate', e.target.value)} />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground mb-1 block">施工預計開始</label>
                                <Input type="date" value={filters.planStartDate} onChange={(e) => handleChange('planStartDate', e.target.value)} />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground mb-1 block">施工預計結束</label>
                                <Input type="date" value={filters.planEndDate} onChange={(e) => handleChange('planEndDate', e.target.value)} />
                            </div>
                            {!hideStatus && (
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground mb-1 block">維修狀態</label>
                                    <Select key={filters.status || 'empty-status'} value={filters.status || undefined} onValueChange={(val) => handleChange('status', val)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="狀態" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="已轉維修單">已轉維修單</SelectItem>
                                            <SelectItem value="開單主管簽核中">開單主管簽核中</SelectItem>
                                            <SelectItem value="工務部門報價，主管簽核中">工務部門報價，主管簽核中</SelectItem>
                                            <SelectItem value="發包部門主管簽核中">發包部門主管簽核中</SelectItem>
                                            <SelectItem value="發包主任/院長簽核中">發包主任/院長簽核中</SelectItem>
                                            <SelectItem value="副院長/院長簽核中">副院長/院長簽核中</SelectItem>
                                            <SelectItem value="採購/資材/院長審查中">採購/資材/院長審查中</SelectItem>
                                            <SelectItem value="廠商施工中">廠商施工中</SelectItem>
                                            <SelectItem value="驗收單位主管簽核中">驗收單位主管簽核中</SelectItem>
                                            <SelectItem value="維修部門驗收中">維修部門驗收中</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div>
                                <label className="text-sm font-medium text-muted-foreground mb-1 block">金額</label>
                                <Select value={filters.amount || 'all'} onValueChange={(val) => handleChange('amount', val === 'all' ? '' : val)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="不限" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">不限</SelectItem>
                                        <SelectItem value="lte20k">小於等於2萬</SelectItem>
                                        <SelectItem value="gt20k">大於2萬</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground mb-1 block">分期期數大於</label>
                                <Input type="number" min="0" value={filters.installmentCountGte} onChange={(e) => handleChange('installmentCountGte', e.target.value)} placeholder="期數" />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground mb-1 block">分期期數小於</label>
                                <Input type="number" min="0" value={filters.installmentCountLte} onChange={(e) => handleChange('installmentCountLte', e.target.value)} placeholder="期數" />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
